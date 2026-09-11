import { defineConfig } from 'vite';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const modelSource = resolve(__dirname, '../vision-model/models/best.onnx');
const modelTargetDir = resolve(__dirname, 'public/models');
const modelTarget = resolve(modelTargetDir, 'best.onnx');

const testImageSource = resolve(__dirname, '../vision-model/test_images/test.png');
const testImageTargetDir = resolve(__dirname, 'public/test-images');
const testImageTarget = resolve(testImageTargetDir, 'test.png');

const manifestSource = resolve(__dirname, 'manifest.json');
const manifestTarget = resolve(__dirname, 'dist/manifest.json');

if (!existsSync(modelTargetDir)) {
  mkdirSync(modelTargetDir, { recursive: true });
}
if (!existsSync(testImageTargetDir)) {
  mkdirSync(testImageTargetDir, { recursive: true });
}
if (existsSync(modelSource)) {
  copyFileSync(modelSource, modelTarget);
}
if (existsSync(testImageSource)) {
  copyFileSync(testImageSource, testImageTarget);
}

const copyExtensionManifest = {
  name: 'copy-extension-manifest',
  writeBundle() {
    if (existsSync(manifestSource)) {
      mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
      copyFileSync(manifestSource, manifestTarget);
    }
  }
};

export default defineConfig({
  plugins: [copyExtensionManifest],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  publicDir: 'public'
});
