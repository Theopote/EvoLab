import type { AnthropicImageMediaType } from "@/lib/anthropic-types";
import type { SheetCornerDetectionResult } from "@/lib/schemas/sheet-corner-detection-schema";

export type ImagePoint = [number, number];

/** Corner order: top-left, top-right, bottom-right, bottom-left. */
export type PerspectiveQuad = [ImagePoint, ImagePoint, ImagePoint, ImagePoint];

export function defaultPerspectiveQuad(inset = 0.02): PerspectiveQuad {
  const max = 1 - inset;
  return [
    [inset, inset],
    [max, inset],
    [max, max],
    [inset, max]
  ];
}

export function isDefaultPerspectiveQuad(quad: PerspectiveQuad, tolerance = 0.001) {
  const baseline = defaultPerspectiveQuad();

  return quad.every((point, index) => {
    const reference = baseline[index];
    return Math.abs(point[0] - reference[0]) <= tolerance && Math.abs(point[1] - reference[1]) <= tolerance;
  });
}

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for correction."));
    image.src = dataUrl;
  });
}

export function inferMediaType(dataUrl: string): AnthropicImageMediaType {
  if (dataUrl.startsWith("data:image/png")) {
    return "image/png";
  }

  if (dataUrl.startsWith("data:image/webp")) {
    return "image/webp";
  }

  if (dataUrl.startsWith("data:image/gif")) {
    return "image/gif";
  }

  return "image/jpeg";
}

export function encodeCanvasToDataUrl(
  canvas: HTMLCanvasElement,
  dataUrl: string,
  quality = 0.92
): { dataUrl: string; base64: string; mediaType: AnthropicImageMediaType; byteLength: number } {
  const mediaType = inferMediaType(dataUrl);
  const outputType = mediaType === "image/png" ? "image/png" : "image/jpeg";
  const nextDataUrl = canvas.toDataURL(outputType, quality);
  const commaIndex = nextDataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? nextDataUrl.slice(commaIndex + 1) : nextDataUrl;
  const byteLength = Math.floor((base64.length * 3) / 4);

  return {
    dataUrl: nextDataUrl,
    base64,
    mediaType,
    byteLength
  };
}

export function quadToPixelCoordinates(quad: PerspectiveQuad, width: number, height: number): PerspectiveQuad {
  return quad.map(([x, y]) => [x * width, y * height]) as PerspectiveQuad;
}

export function clampPerspectiveQuad(quad: PerspectiveQuad): PerspectiveQuad {
  return quad.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))]) as PerspectiveQuad;
}

export function cornersResultToQuad(result: SheetCornerDetectionResult): PerspectiveQuad {
  return clampPerspectiveQuad([
    result.corners.topLeft,
    result.corners.topRight,
    result.corners.bottomRight,
    result.corners.bottomLeft
  ]);
}
