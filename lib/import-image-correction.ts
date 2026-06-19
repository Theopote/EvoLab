import type { AnthropicImageMediaType } from "@/lib/anthropic-tool";

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image for correction."));
    image.src = dataUrl;
  });
}

function inferMediaType(dataUrl: string): AnthropicImageMediaType {
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

export async function rotateImageDataUrl(
  dataUrl: string,
  degrees: 90 | -90 | 180
): Promise<{ dataUrl: string; base64: string; mediaType: AnthropicImageMediaType; byteLength: number }> {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available for image correction.");
  }

  const radians = (degrees * Math.PI) / 180;
  const swapDimensions = Math.abs(degrees) === 90;
  canvas.width = swapDimensions ? image.height : image.width;
  canvas.height = swapDimensions ? image.width : image.height;

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, -image.width / 2, -image.height / 2);

  const mediaType = inferMediaType(dataUrl);
  const outputType = mediaType === "image/png" ? "image/png" : "image/jpeg";
  const nextDataUrl = canvas.toDataURL(outputType, 0.92);
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
