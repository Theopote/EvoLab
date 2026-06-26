export function depthRgbaToGrayscale(
  rgba: Uint8Array,
  width: number,
  height: number,
  invertNearBright = true
): Uint8Array {
  const count = width * height;
  const out = new Uint8Array(count);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < count; index += 1) {
    const value = rgba[index * 4] ?? 0;
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  const range = Math.max(max - min, 1e-6);

  for (let index = 0; index < count; index += 1) {
    const value = rgba[index * 4] ?? 0;
    const normalized = (value - min) / range;
    out[index] = invertNearBright ? Math.round((1 - normalized) * 255) : Math.round(normalized * 255);
  }

  return out;
}

export function grayscaleToPngDataUrl(grayscale: Uint8Array, width: number, height: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create canvas context for depth export.");
  }

  const imageData = context.createImageData(width, height);

  for (let index = 0; index < width * height; index += 1) {
    const gray = grayscale[index] ?? 0;
    imageData.data[index * 4] = gray;
    imageData.data[index * 4 + 1] = gray;
    imageData.data[index * 4 + 2] = gray;
    imageData.data[index * 4 + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export function depthRgbaToDataUrl(rgba: Uint8Array, width: number, height: number): string {
  return grayscaleToPngDataUrl(depthRgbaToGrayscale(rgba, width, height), width, height);
}
