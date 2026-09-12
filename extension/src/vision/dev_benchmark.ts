import { loadVisionModel } from './model';
import { runVisionInference } from './inference';

async function loadDemoImage(): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load demo image.'));
    img.src = '/test-images/test.png';
  });
  return img;
}

function computeStats(timings: number[]) {
  const sorted = [...timings].sort((a, b) => a - b);
  const sum = timings.reduce((s, n) => s + n, 0);
  const mean = sum / timings.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(timings.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { mean, median, p95, min, max };
}

export async function runDevBenchmark(options?: { image?: HTMLImageElement; warmups?: number; runs?: number }) {
  const warmups = options?.warmups ?? 1;
  const runs = options?.runs ?? 30;

  // Load model once
  const { session, provider } = await loadVisionModel();

  // Acquire image (prefer provided, else demo)
  let image = options?.image;
  if (!image) {
    try {
      image = await loadDemoImage();
    } catch (e) {
      throw new Error('Failed to load demo image for benchmark.');
    }
  }

  // Warmups
  for (let i = 0; i < warmups; i++) {
    await runVisionInference(image, image.naturalWidth || image.width, image.naturalHeight || image.height, session);
  }

  // Measured runs
  const timings: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    const det = await runVisionInference(image, image.naturalWidth || image.width, image.naturalHeight || image.height, session);
    const ms = performance.now() - start;
    timings.push(ms);
    // keep last detections for reporting
    (window as any).__cyclops_benchmark_last_detections = det;
  }

  const stats = computeStats(timings);

  const result = {
    model: 'best.onnx',
    provider,
    warmups,
    runs,
    timings,
    stats,
    detections: (window as any).__cyclops_benchmark_last_detections ?? null
  };

  // Expose for automation scripts
  (window as any).__cyclops_benchmark = result;
  return result;
}

// Auto-run if requested via query param ?bench=1
if (typeof window !== 'undefined' && window.location && window.location.search.includes('bench')) {
  void (async () => {
    try {
      await runDevBenchmark();
    } catch (e) {
      (window as any).__cyclops_benchmark = { error: String(e) };
    }
  })();
}
