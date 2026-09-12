import { runVisionInference } from './inference';
import { captureVisibleTab } from './screenCapture';

// If opened by the automated benchmark runner, defer to the dev benchmark module.
if (typeof window !== 'undefined' && window.location && window.location.search.includes('bench')) {
  void import('./dev_benchmark');
}

function el(tag: string, props: any = {}, ...children: (HTMLElement | string)[]) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'onclick') node.addEventListener('click', v as any);
    else if (k === 'class') node.className = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

function safeText(text: string) {
  const pre = document.createElement('pre');
  pre.textContent = text;
  return pre;
}

async function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const header = el('h1', {}, 'Cyclops Vision');
  const status = el('div', { id: 'status' }, 'Model: not loaded');
  const backend = el('div', { id: 'backend' }, `WebGPU: ${'gpu' in navigator}`);
  const runBtn = el('button', { id: 'run' }, 'Run Vision (capture current page)') as HTMLButtonElement;
  const resultArea = el('div', { id: 'result' });
  const errorArea = el('div', { id: 'error', style: 'color: red;' });

  app.appendChild(header);
  app.appendChild(status);
  app.appendChild(backend);
  app.appendChild(runBtn);
  app.appendChild(errorArea);
  app.appendChild(resultArea);

  runBtn.addEventListener('click', async () => {
    errorArea.textContent = '';
    resultArea.innerHTML = '';
    status.textContent = 'Capturing visible tab...';
    runBtn.disabled = true;

    try {
      const img = await captureVisibleTab();
      status.textContent = 'Captured; running inference...';

      const start = performance.now();
      const detections = await runVisionInference(img, img.naturalWidth || img.width, img.naturalHeight || img.height);
      const ms = performance.now() - start;

      status.textContent = `Model: loaded — ${detections.length} detections (${ms.toFixed(1)} ms)`;
      const details = document.createElement('div');
      details.appendChild(el('h3', {}, 'Detections'));
      details.appendChild(safeText(JSON.stringify(detections, null, 2)));
      details.appendChild(el('h3', {}, 'Image preview'));
      const imgPreview = document.createElement('img');
      imgPreview.src = img.src;
      imgPreview.style.maxWidth = '240px';
      details.appendChild(imgPreview);

      details.appendChild(el('h3', {}, 'Timing'));
      details.appendChild(safeText(`Inference: ${ms.toFixed(1)} ms`));

      resultArea.appendChild(details);
    } catch (e: any) {
      console.error(e);
      errorArea.textContent = String(e?.message ?? e);
      status.textContent = 'Model: error';
    } finally {
      runBtn.disabled = false;
    }
  });
}

// Initialize UI without loading the model until user requests inference.
void init();
