import { loadVisionModel } from './model';
import { runVisionInference } from './inference';

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load ' + url));
    img.src = url;
  });
  return img;
}

export type ValidationResult = {
  image: string;
  detections: any[];
  latencyMs: number;
};

export async function runValidation(imageUrls: string[]): Promise<ValidationResult[]> {
  const { session, provider } = await loadVisionModel();
  const results: ValidationResult[] = [];

  for (const url of imageUrls) {
    const img = await loadImage(url);
    const start = performance.now();
    const detections = await runVisionInference(img, img.naturalWidth || img.width, img.naturalHeight || img.height, session);
    const ms = performance.now() - start;

    results.push({ image: url, detections, latencyMs: ms });
  }

  // Expose for dev inspection
  (window as any).__cyclops_validation = { provider, results };
  return results;
}

// If requested via query param ?validate=1 run validation on developer images
if (typeof window !== 'undefined' && window.location && window.location.search.includes('validate')) {
  void (async () => {
    try {
      const urls = ['/test-images/test.png'];
      await runValidation(urls);
    } catch (e) {
      (window as any).__cyclops_validation = { error: String(e) };
    }
  })();
}
