import type { Point } from "@/lib/project-types";
import { createPlanSvg } from "@/lib/export-utils";
import type { PlanVersion } from "@/lib/project-types";
import type { SelectionBBox } from "@/lib/region-lock";

const MASK_WIDTH = 1024;
const MASK_HEIGHT = 768;

function scalePoints(points: Point[], version: PlanVersion): Point[] {
  const width = version.overallBounds.width + 16;
  const height = version.overallBounds.height + 16;

  return points.map(([x, y]) => [
    ((x + 8) / width) * MASK_WIDTH,
    ((y + 8) / height) * MASK_HEIGHT
  ]);
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  if (points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }

  ctx.stroke();
}

export async function captureInpaintImages(
  version: PlanVersion,
  strokes: Point[][],
  levelId?: string
) {
  const planCanvas = document.createElement("canvas");
  planCanvas.width = MASK_WIDTH;
  planCanvas.height = MASK_HEIGHT;
  const planContext = planCanvas.getContext("2d");

  if (!planContext) {
    throw new Error("Failed to create plan capture canvas.");
  }

  const svgBlob = new Blob([createPlanSvg(version, levelId)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to rasterize plan SVG."));
    image.src = svgUrl;
  });

  planContext.fillStyle = "#081018";
  planContext.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
  planContext.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
  URL.revokeObjectURL(svgUrl);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = MASK_WIDTH;
  maskCanvas.height = MASK_HEIGHT;
  const maskContext = maskCanvas.getContext("2d");

  if (!maskContext) {
    throw new Error("Failed to create mask canvas.");
  }

  maskContext.fillStyle = "#000000";
  maskContext.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
  maskContext.strokeStyle = "#ffffff";
  maskContext.lineWidth = 18;
  maskContext.lineCap = "round";
  maskContext.lineJoin = "round";

  strokes.forEach((stroke) => drawStroke(maskContext, scalePoints(stroke, version)));

  const baseImage = planCanvas.toDataURL("image/png");
  const maskImage = maskCanvas.toDataURL("image/png");

  return { baseImage, maskImage };
}

function scaleBBox(bbox: SelectionBBox, version: PlanVersion) {
  const width = version.overallBounds.width + 16;
  const height = version.overallBounds.height + 16;

  return {
    x: ((bbox.minX + 8) / width) * MASK_WIDTH,
    y: ((bbox.minY + 8) / height) * MASK_HEIGHT,
    width: ((bbox.maxX - bbox.minX) / width) * MASK_WIDTH,
    height: ((bbox.maxY - bbox.minY) / height) * MASK_HEIGHT
  };
}

export async function captureInpaintImagesFromBBox(
  version: PlanVersion,
  bbox: SelectionBBox,
  levelId?: string
) {
  const planCanvas = document.createElement("canvas");
  planCanvas.width = MASK_WIDTH;
  planCanvas.height = MASK_HEIGHT;
  const planContext = planCanvas.getContext("2d");

  if (!planContext) {
    throw new Error("Failed to create plan capture canvas.");
  }

  const svgBlob = new Blob([createPlanSvg(version, levelId)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to rasterize plan SVG."));
    image.src = svgUrl;
  });

  planContext.fillStyle = "#081018";
  planContext.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
  planContext.drawImage(image, 0, 0, MASK_WIDTH, MASK_HEIGHT);
  URL.revokeObjectURL(svgUrl);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = MASK_WIDTH;
  maskCanvas.height = MASK_HEIGHT;
  const maskContext = maskCanvas.getContext("2d");

  if (!maskContext) {
    throw new Error("Failed to create mask canvas.");
  }

  maskContext.fillStyle = "#000000";
  maskContext.fillRect(0, 0, MASK_WIDTH, MASK_HEIGHT);
  maskContext.fillStyle = "#ffffff";

  const scaled = scaleBBox(bbox, version);
  maskContext.fillRect(scaled.x, scaled.y, scaled.width, scaled.height);

  return {
    baseImage: planCanvas.toDataURL("image/png"),
    maskImage: maskCanvas.toDataURL("image/png")
  };
}
