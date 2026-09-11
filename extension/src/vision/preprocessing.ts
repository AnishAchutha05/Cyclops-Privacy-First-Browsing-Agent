import {
  MODEL_CHANNELS,
  MODEL_SIZE
} from './config';

export interface LetterboxMeta {
  originalWidth: number;
  originalHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  scale: number;
  padX: number;
  padY: number;
}

export function preprocessImageToTensor(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData
): { tensor: Float32Array; letterbox: LetterboxMeta } {
  const inputWidth = source instanceof ImageData ? source.width : source.width;
  const inputHeight = source instanceof ImageData ? source.height : source.height;

  const scale = Math.min(MODEL_SIZE / inputHeight, MODEL_SIZE / inputWidth);
  const resizedWidth = Math.max(1, Math.round(inputWidth * scale));
  const resizedHeight = Math.max(1, Math.round(inputHeight * scale));
  const padX = Math.floor((MODEL_SIZE - resizedWidth) / 2);
  const padY = Math.floor((MODEL_SIZE - resizedHeight) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for letterbox preprocessing.');
  }

  ctx.clearRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  ctx.fillStyle = 'rgb(114, 114, 114)';
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);

  ctx.drawImage(
    source as CanvasImageSource,
    0,
    0,
    inputWidth,
    inputHeight,
    padX,
    padY,
    resizedWidth,
    resizedHeight
  );

  const imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const tensor = new Float32Array(MODEL_CHANNELS * MODEL_SIZE * MODEL_SIZE);

  for (let index = 0; index < MODEL_SIZE * MODEL_SIZE; index++) {
    const offset = index * 4;
    const r = imageData.data[offset] / 255.0;
    const g = imageData.data[offset + 1] / 255.0;
    const b = imageData.data[offset + 2] / 255.0;

    tensor[index] = r;
    tensor[index + MODEL_SIZE * MODEL_SIZE] = g;
    tensor[index + 2 * MODEL_SIZE * MODEL_SIZE] = b;
  }

  return {
    tensor,
    letterbox: {
      originalWidth: inputWidth,
      originalHeight: inputHeight,
      resizedWidth,
      resizedHeight,
      scale,
      padX,
      padY
    }
  };
}
