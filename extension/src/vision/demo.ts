import { runVisionInference } from './inference';

async function loadDemoImage(): Promise<HTMLImageElement> {
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load vision demo image.'));
    image.src = '/test-images/test.png';
  });

  return image;
}

async function runDemo(): Promise<void> {
  const image = await loadDemoImage();
  const detections = await runVisionInference(
    image,
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );

  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Missing app container.');
  }

  app.innerHTML = `
    <h1>Cyclops local vision demo</h1>
    <pre>${JSON.stringify(detections, null, 2)}</pre>
  `;

  console.log('Detected:', detections);
}

void runDemo();
