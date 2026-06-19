import type { Point } from "@/lib/project-types";
import type { ProcessedLoop } from "@/lib/sketch-processing";
import { createPlanSvg } from "@/lib/export-utils";
import type { PlanVersion } from "@/lib/project-types";

const SKETCH_WIDTH = 1024;
const SKETCH_HEIGHT = 768;

function scalePoints(points: Point[], version: PlanVersion): Point[] {
  const width = version.overallBounds.width + 16;
  const height = version.overallBounds.height + 16;

  return points.map(([x, y]) => [
    ((x + 8) / width) * SKETCH_WIDTH,
    ((y + 8) / height) * SKETCH_HEIGHT
  ]);
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[], color: string, lineWidth: number) {
  if (points.length < 2) {
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index][0], points[index][1]);
  }

  ctx.stroke();
}

export async function captureSketchImage(
  version: PlanVersion,
  strokes: Point[][],
  ghostLoops: ProcessedLoop[] = []
) {
  const canvas = document.createElement("canvas");
  canvas.width = SKETCH_WIDTH;
  canvas.height = SKETCH_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to create sketch capture canvas.");
  }

  const svgBlob = new Blob([createPlanSvg(version)], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to rasterize plan SVG."));
    image.src = svgUrl;
  });

  context.fillStyle = "#081018";
  context.fillRect(0, 0, SKETCH_WIDTH, SKETCH_HEIGHT);
  context.globalAlpha = 0.45;
  context.drawImage(image, 0, 0, SKETCH_WIDTH, SKETCH_HEIGHT);
  context.globalAlpha = 1;
  URL.revokeObjectURL(svgUrl);

  context.lineCap = "round";
  context.lineJoin = "round";

  strokes.forEach((stroke) => {
    drawStroke(context, scalePoints(stroke, version), "rgba(226,232,240,0.9)", 3);
  });

  ghostLoops.forEach((loop) => {
    const scaled = scalePoints([...loop.polygon, loop.polygon[0]], version);
    drawStroke(context, scaled, "rgba(79,181,200,0.75)", 2);
  });

  return canvas.toDataURL("image/png");
}
