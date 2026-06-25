import { encodeCanvasToDataUrl, loadImage } from "@/lib/import-image-utils";

export { loadImage, inferMediaType, encodeCanvasToDataUrl } from "@/lib/import-image-utils";
export type { ImagePoint, PerspectiveQuad } from "@/lib/import-image-utils";
export { defaultPerspectiveQuad, isDefaultPerspectiveQuad } from "@/lib/import-image-utils";

export async function rotateImageDataUrl(
  dataUrl: string,
  degrees: 90 | -90 | 180
) {
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

  return encodeCanvasToDataUrl(canvas, dataUrl);
}
