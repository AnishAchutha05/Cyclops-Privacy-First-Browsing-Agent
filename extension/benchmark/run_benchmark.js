import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(){
  const { chromium } = await import('playwright');

  const extPath = path.resolve(__dirname, '..', 'dist');
  const userDataDir = path.join(os.tmpdir(), `cyclops-profile-${Date.now()}`);

  console.log('Launching Chromium with extension:', extPath);

  // Prefer system Chrome/Chromium if available to improve extension support
  const candidatePaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  let execPath = null;
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        execPath = p;
        break;
      }
    } catch (e) {}
  }

  const launchOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`
    ]
  };

  if (execPath) {
    launchOptions.executablePath = execPath;
    console.log('Using system browser executable:', execPath);
  } else {
    console.log('No system browser found; using Playwright bundled Chromium');
  }

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);

  try {
    // Try to detect extension origin from pages or service workers
    const timeoutMs = 120000;
    const start = Date.now();
    let extOrigin = null;

    while (Date.now() - start < timeoutMs && !extOrigin) {
      // check pages
      for (const p of context.pages()) {
        try {
          const url = p.url();
          if (url.startsWith('chrome-extension://')) {
            const u = new URL(url);
            extOrigin = `${u.protocol}//${u.host}`;
            break;
          }
        } catch (e) {
          // ignore
        }
      }

      if (extOrigin) break;

      // check service workers
      for (const sw of context.serviceWorkers()) {
        try {
          const url = sw.url();
          if (url.startsWith('chrome-extension://')) {
            const u = new URL(url);
            extOrigin = `${u.protocol}//${u.host}`;
            break;
          }
        } catch (e) {}
      }

      if (extOrigin) break;

      // wait briefly for extension to load
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!extOrigin) {
      // dump diagnostics
      const pageUrls = context.pages().map(p => {
        try { return p.url(); } catch (e) { return String(e); }
      });
      const swUrls = context.serviceWorkers().map(s => {
        try { return s.url(); } catch (e) { return String(e); }
      });
      const bgPages = context.backgroundPages().map(p => {
        try { return p.url(); } catch (e) { return String(e); }
      });
      const diagnostics = { pageUrls, swUrls, bgPages };
      console.log('Primary launch diagnostics:', JSON.stringify(diagnostics));

      // Fallback: spawn a standalone Chrome with remote debugging and load the extension, then connect via CDP
      console.log('Falling back to spawning system Chrome with remote debugging...');
      const { spawn } = await import('child_process');
      const chromePath = launchOptions.executablePath || null;
      if (!chromePath) {
        throw new Error('No system Chrome executable available for fallback.');
      }

      const remotePort = 9222;
      const chromeProc = spawn(chromePath, [
        `--user-data-dir=${userDataDir}`,
        `--remote-debugging-port=${remotePort}`,
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        '--no-first-run',
        '--disable-popup-blocking'
      ], { stdio: 'ignore', detached: true });

      // wait for CDP endpoint
      const fetch = globalThis.fetch;
      const endpointUrl = `http://127.0.0.1:${remotePort}/json/version`;
      const startWait = Date.now();
      let cdpReady = false;
      while (Date.now() - startWait < 20000) {
        try {
          const res = await fetch(endpointUrl);
          if (res.ok) { cdpReady = true; break; }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 500));
      }

      if (!cdpReady) {
        try { process.kill(-chromeProc.pid); } catch (e) {}
        throw new Error('Remote debugging endpoint did not appear in time.');
      }

      const wsEndpoint = `http://127.0.0.1:${remotePort}`;
      const browserCDP = await chromium.connectOverCDP(wsEndpoint);

      // Try to find extension pages from Playwright contexts
      for (const ctx of browserCDP.contexts()) {
        for (const p of ctx.pages()) {
          try {
            const url = p.url();
            if (url.startsWith('chrome-extension://')) {
              const u = new URL(url);
              extOrigin = `${u.protocol}//${u.host}`;
              break;
            }
          } catch (e) {}
        }
        if (extOrigin) break;
      }

      // If not found, query the CDP JSON endpoints for targets
      if (!extOrigin) {
        try {
          const listUrl = `http://127.0.0.1:${remotePort}/json/list`;
          const resp = await fetch(listUrl);
          if (resp && resp.ok) {
            const items = await resp.json();
            for (const it of items) {
              if (it.url && typeof it.url === 'string' && it.url.startsWith('chrome-extension://')) {
                try {
                  const u = new URL(it.url);
                  extOrigin = `${u.protocol}//${u.host}`;
                  break;
                } catch (e) {}
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (!extOrigin) {
        try { browserCDP.close(); } catch (e) {}
        try { process.kill(-chromeProc.pid); } catch (e) {}
        throw new Error('Fallback CDP could not find extension origin.');
      }

      console.log('Fallback detected extension origin:', extOrigin);
      // continue with extOrigin using cdp-driven page
      const page = await browserCDP.newPage();
      const indexUrl = `${extOrigin}/index.html`;
      await page.goto(indexUrl, { waitUntil: 'load', timeout: 60000 });

      // Wait for benchmark results
      await page.waitForFunction(() => window.__cyclops_benchmark !== undefined, { timeout: 180000 });
      const result = await page.evaluate(() => window.__cyclops_benchmark);
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const hasWebGPU = await page.evaluate(() => ('gpu' in navigator));

      // write results same as below
      const modelPath = path.resolve(__dirname, '..', 'dist', 'models', 'best.onnx');
      let modelSize = null;
      try { const st = fs.statSync(modelPath); modelSize = st.size; } catch (e) {}
      const timestamp = new Date().toISOString();
      const out = {
        timestamp,
        model: result?.model ?? 'best.onnx',
        modelSizeBytes: modelSize,
        warmupRuns: result?.warmups ?? null,
        measuredRuns: result?.runs ?? null,
        timingsMs: result?.timings ?? null,
        detections: result?.detections ?? null,
        browserUserAgent: userAgent,
        hasWebGPU,
        extensionOrigin: extOrigin,
        limitations: ['Used CDP fallback']
      };
      const benchmarkDir = path.resolve(__dirname, '..', '..', 'vision-model', 'benchmark');
      fs.mkdirSync(benchmarkDir, { recursive: true });
      const outPath = path.join(benchmarkDir, 'benchmark-results.json');
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
      const mdPath = path.join(benchmarkDir, 'BENCHMARK.md');
      fs.writeFileSync(mdPath, '# Cyclops Benchmark (fallback)\n');

      console.log('Benchmark results saved to', outPath);

      try { cdp.close(); } catch (e) {}
      try { process.kill(-chromeProc.pid); } catch (e) {}
      return;
    }

    console.log('Detected extension origin:', extOrigin);

    const page = await context.newPage();
    const indexUrl = `${extOrigin}/index.html?bench=1`;
    console.log('Navigating to extension page:', indexUrl);
    await page.goto(indexUrl, { waitUntil: 'load', timeout: 60000 });

      // -- additional diagnostics: fetch chrome://extensions/ content
      try {
        const extPage = await context.newPage();
        await extPage.goto('chrome://extensions/', { timeout: 10000 }).catch(()=>{});
        const body = await extPage.evaluate(() => document.documentElement.outerHTML).catch(()=>null);
        if (body) {
          console.log('chrome://extensions/ content length:', body.length);
        } else {
          console.log('Could not read chrome://extensions/ DOM (restricted)');
        }
        await extPage.close();
      } catch (e) {
        console.log('Error fetching chrome://extensions/ diagnostics:', String(e));
      }

    // Wait for benchmark results to be populated on window.__cyclops_benchmark
    console.log('Waiting for benchmark results in page...');
    await page.waitForFunction(() => window.__cyclops_benchmark !== undefined, { timeout: 180000 });

    const result = await page.evaluate(() => window.__cyclops_benchmark);
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const hasWebGPU = await page.evaluate(() => ('gpu' in navigator));

    // read model size
    const modelPath = path.resolve(__dirname, '..', 'dist', 'models', 'best.onnx');
    let modelSize = null;
    try {
      const st = fs.statSync(modelPath);
      modelSize = st.size;
    } catch (e) {
      // ignore
    }

    const timestamp = new Date().toISOString();

    const out = {
      timestamp,
      model: result?.model ?? 'best.onnx',
      modelSizeBytes: modelSize,
      warmupRuns: result?.warmups ?? null,
      measuredRuns: result?.runs ?? null,
      timingsMs: result?.timings ?? null,
      detections: result?.detections ?? null,
      browserUserAgent: userAgent,
      hasWebGPU,
      extensionOrigin: extOrigin,
      limitations: []
    };

    // Save JSON
    const benchmarkDir = path.resolve(__dirname, '..', '..', 'vision-model', 'benchmark');
    fs.mkdirSync(benchmarkDir, { recursive: true });
    const outPath = path.join(benchmarkDir, 'benchmark-results.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

    // Create a simple BENCHMARK.md
    const md = [];
    md.push('# Cyclops Vision Browser Benchmark');
    md.push('');
    md.push(`Timestamp: ${timestamp}`);
    md.push('');
    md.push('## Summary');
    md.push('');
    md.push(`- Model: ${out.model}`);
    md.push(`- Model size (bytes): ${out.modelSizeBytes}`);
    md.push(`- Browser: ${userAgent}`);
    md.push(`- WebGPU available: ${hasWebGPU}`);
    md.push('');
    md.push('## Results');
    md.push('');
    md.push(`- Warmup runs: ${out.warmupRuns}`);
    md.push(`- Measured runs: ${out.measuredRuns}`);
    if (Array.isArray(out.timingsMs)) {
      const sorted = [...out.timingsMs].sort((a,b)=>a-b);
      const sum = out.timingsMs.reduce((s,n)=>s+n,0);
      const mean = sum / out.timingsMs.length;
      const median = sorted[Math.floor(sorted.length/2)];
      const p95 = sorted[Math.floor(sorted.length*0.95)];
      const min = sorted[0];
      const max = sorted[sorted.length-1];
      const variance = out.timingsMs.reduce((s,n)=>s+(n-mean)*(n-mean),0)/out.timingsMs.length;
      const std = Math.sqrt(variance);
      md.push(`- Min: ${min.toFixed(2)} ms`);
      md.push(`- Mean: ${mean.toFixed(2)} ms`);
      md.push(`- Median: ${median.toFixed(2)} ms`);
      md.push(`- P95: ${p95.toFixed(2)} ms`);
      md.push(`- Max: ${max.toFixed(2)} ms`);
      md.push(`- Std dev: ${std.toFixed(2)} ms`);
      md.push(`- FPS (mean): ${(1000/mean).toFixed(2)}`);
    }

    md.push('');
    md.push('## Detections (example)');
    md.push('');
    md.push('```json');
    md.push(JSON.stringify(out.detections, null, 2));
    md.push('```');

    const mdPath = path.join(benchmarkDir, 'BENCHMARK.md');
    fs.writeFileSync(mdPath, md.join('\n'));

    console.log('Benchmark results saved to', outPath);
    console.log('BENCHMARK.md saved to', mdPath);

  } catch (err) {
    console.error('Benchmark failed:', err);
    process.exitCode = 2;
  } finally {
    try {
      await context.close();
    } catch (e) {}
  }
}

main();
