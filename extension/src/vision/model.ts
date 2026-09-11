import * as ort from 'onnxruntime-web';

import { MODEL_INPUT_NAME, MODEL_OUTPUT_NAME } from './config';

export function configureOrtForBrowser(): void {
  ort.env.wasm.simd = true;
  ort.env.wasm.numThreads = 1;
}

export function resolveModelUrl(): string {
  const runtime = (globalThis as any).chrome?.runtime;
  if (runtime && typeof runtime.getURL === 'function') {
    return runtime.getURL('models/best.onnx');
  }
  return '/models/best.onnx';
}

export async function loadVisionModel(): Promise<ort.InferenceSession> {
  const providers: string[] = [];

  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    providers.push('webgpu');
  }

  providers.push('wasm');

  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const session = await ort.InferenceSession.create(resolveModelUrl(), {
        executionProviders: [provider],
        graphOptimizationLevel: 'all'
      });

      const inputNames = session.inputNames;
      const outputNames = session.outputNames;

      if (!inputNames.includes(MODEL_INPUT_NAME)) {
        throw new Error(`Model input '${MODEL_INPUT_NAME}' not found.`);
      }

      if (!outputNames.includes(MODEL_OUTPUT_NAME)) {
        throw new Error(`Model output '${MODEL_OUTPUT_NAME}' not found.`);
      }

      return session;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to load model with providers ${providers.join(', ')}. Last error: ${String(lastError)}`
  );
}
