export async function captureVisibleTab(): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    try {
      const captureFn = (chrome.tabs as any)?.captureVisibleTab ?? (window as any).chrome?.tabs?.captureVisibleTab;
      if (typeof captureFn !== 'function') {
        reject(new Error('captureVisibleTab is not available in this context.'));
        return;
      }

      // Request a PNG data URL of the current visible tab.
      // Use undefined for windowId so the current window is used.
      captureFn(undefined, { format: 'png' }, (dataUrl: string) => {
        const err = (chrome.runtime as any)?.lastError;
        if (err) {
          reject(new Error(String(err.message || err)));
          return;
        }

        if (!dataUrl) {
          reject(new Error('No data returned from captureVisibleTab.'));
          return;
        }

        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load captured image.'));
        img.src = dataUrl;
      });
    } catch (e) {
      reject(e);
    }
  });
}
