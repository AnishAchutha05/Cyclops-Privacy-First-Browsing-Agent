import * as ort from 'onnxruntime-web';

import {
  CYCLOPS_CLASSES,
  CONFIDENCE_THRESHOLD,
  MODEL_ANCHORS,
  MODEL_OUTPUT_CHANNELS,
  MODEL_SIZE,
  NMS_IOU_THRESHOLD,
  type Detection
} from './config';
import { loadVisionModel, configureOrtForBrowser } from './model';
import { preprocessImageToTensor, type LetterboxMeta } from './preprocessing';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeIoU(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  const interWidth = Math.max(0, right - left);
  const interHeight = Math.max(0, bottom - top);
  const intersection = interWidth * interHeight;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const union = areaA + areaB - intersection;

  if (union <= 0) {
    return 0;
  }

  return intersection / union;
}

function classAwareNMS(detections: Detection[]): Detection[] {
  const byClass = new Map<number, Detection[]>();

  for (const detection of detections) {
    const group = byClass.get(detection.classId) ?? [];
    group.push(detection);
    byClass.set(detection.classId, group);
  }

  const finalDetections: Detection[] = [];

  for (const [, group] of byClass.entries()) {
    const sorted = [...group].sort((a, b) => b.confidence - a.confidence);
    const kept: Detection[] = [];

    for (const candidate of sorted) {
      let suppressed = false;

      for (const existing of kept) {
        if (computeIoU(candidate.bbox, existing.bbox) > NMS_IOU_THRESHOLD) {
          suppressed = true;
          break;
        }
      }

      if (!suppressed) {
        kept.push(candidate);
      }
    }

    finalDetections.push(...kept);
  }

  return finalDetections.sort((a, b) => b.confidence - a.confidence);
}

function decodeModelOutput(
  data: Float32Array,
  originalWidth: number,
  originalHeight: number,
  letterbox: LetterboxMeta
): Detection[] {
  const detections: Detection[] = [];

  for (let anchor = 0; anchor < MODEL_ANCHORS; anchor++) {
    const x = data[0 * MODEL_ANCHORS + anchor];
    const y = data[1 * MODEL_ANCHORS + anchor];
    const width = data[2 * MODEL_ANCHORS + anchor];
    const height = data[3 * MODEL_ANCHORS + anchor];

    const classScores = Array.from({ length: 10 }, (_, classId) => {
      return data[(4 + classId) * MODEL_ANCHORS + anchor];
    });

    let bestClassId = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let classId = 0; classId < classScores.length; classId++) {
      const score = classScores[classId];
      if (score > bestScore) {
        bestScore = score;
        bestClassId = classId;
      }
    }

    if (!Number.isFinite(bestScore) || bestScore < CONFIDENCE_THRESHOLD) {
      continue;
    }

    const cx = (x - letterbox.padX) / letterbox.scale;
    const cy = (y - letterbox.padY) / letterbox.scale;
    const bw = Math.max(1, width / letterbox.scale);
    const bh = Math.max(1, height / letterbox.scale);

    const x1 = cx - bw / 2;
    const y1 = cy - bh / 2;
    const x2 = x1 + bw;
    const y2 = y1 + bh;

    const left = clamp(x1, 0, originalWidth);
    const top = clamp(y1, 0, originalHeight);
    const right = clamp(x2, 0, originalWidth);
    const bottom = clamp(y2, 0, originalHeight);

    const bboxWidth = Math.max(0, right - left);
    const bboxHeight = Math.max(0, bottom - top);

    if (bboxWidth <= 0 || bboxHeight <= 0) {
      continue;
    }

    detections.push({
      classId: bestClassId,
      className: CYCLOPS_CLASSES[bestClassId] ?? `Class ${bestClassId}`,
      confidence: bestScore,
      bbox: {
        x: left,
        y: top,
        width: bboxWidth,
        height: bboxHeight
      }
    });
  }

  return classAwareNMS(detections);
}

export async function runVisionInference(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData,
  originalWidth: number,
  originalHeight: number
): Promise<Detection[]> {
  configureOrtForBrowser();

  const session = await loadVisionModel();
  const { tensor, letterbox } = preprocessImageToTensor(image);

  const modelInput = new ort.Tensor('float32', tensor, [1, 3, MODEL_SIZE, MODEL_SIZE]);
  const output = await session.run({ images: modelInput });
  const rawOutput = output.output0 as ort.Tensor;
  const data = rawOutput.data as Float32Array;

  return decodeModelOutput(data, originalWidth, originalHeight, letterbox);
}

export async function demoLocalInference(
  image: HTMLImageElement | HTMLCanvasElement | ImageBitmap | ImageData
): Promise<Detection[]> {
  const width = image instanceof ImageData ? image.width : image.width;
  const height = image instanceof ImageData ? image.height : image.height;

  const detections = await runVisionInference(image, width, height);

  console.log(
    detections
      .slice(0, 10)
      .map((d) => `${d.className} ${d.confidence.toFixed(2)} [${d.bbox.x},${d.bbox.y},${d.bbox.width},${d.bbox.height}]`)
      .join('\n')
  );

  return detections;
}
