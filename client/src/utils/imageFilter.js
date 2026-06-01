// Counter-invert images so they look correct under Excalidraw's dark-mode
// canvas filter. In dark theme Excalidraw applies
//   filter: invert(93%) hue-rotate(180deg)
// to the WHOLE canvas (images included). By pre-applying the SAME filter to an
// image's pixels, the canvas filter cancels it back to ~the original — so the
// image displays in true color in dark mode. Light mode uses the untouched original.

const DARK_FILTER = "invert(93%) hue-rotate(180deg)";

// Returns a Promise<dataURL> of the image with the dark filter baked in.
// Resolves to the original dataURL if anything fails (best-effort, never throws).
export function counterInvertDataUrl(dataUrl) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.filter = DARK_FILTER;
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}
