import { apiError, apiOk } from "@/lib/server/api-response";
import type { CalibrateImportRequest, CalibrateImportResponse, ImportCalibration } from "@/lib/import-types";
import { z } from "zod";

const CalibrateImportRequestSchema = z.object({
  sessionId: z.string().min(1),
  points: z.array(
    z.object({
      pixel: z.tuple([z.number(), z.number()]),
      world: z.tuple([z.number(), z.number()]),
      label: z.string().optional()
    })
  ).min(2).max(10), // Need at least 2 points for calibration
  unit: z.enum(["mm", "m", "ft", "in"])
});

/**
 * Calculate scale and rotation from calibration points
 * Uses least squares fitting for robust calibration
 */
function calculateCalibration(
  points: Array<{ pixel: [number, number]; world: [number, number] }>
): { scale: number; rotation: number; offset: [number, number] } {
  if (points.length < 2) {
    throw new Error("Need at least 2 calibration points");
  }

  // For 2 points, calculate direct scale and rotation
  if (points.length === 2) {
    const [p1Pixel, p2Pixel] = [points[0].pixel, points[1].pixel];
    const [p1World, p2World] = [points[0].world, points[1].world];

    // Distance in pixel space
    const pixelDist = Math.hypot(p2Pixel[0] - p1Pixel[0], p2Pixel[1] - p1Pixel[1]);

    // Distance in world space
    const worldDist = Math.hypot(p2World[0] - p1World[0], p2World[1] - p1World[1]);

    if (pixelDist === 0 || worldDist === 0) {
      throw new Error("Calibration points are too close together");
    }

    const scale = worldDist / pixelDist;

    // Rotation (pixel to world)
    const pixelAngle = Math.atan2(p2Pixel[1] - p1Pixel[1], p2Pixel[0] - p1Pixel[0]);
    const worldAngle = Math.atan2(p2World[1] - p1World[1], p2World[0] - p1World[0]);
    const rotation = (worldAngle - pixelAngle) * (180 / Math.PI);

    // Offset (translation)
    const cos = Math.cos(worldAngle - pixelAngle);
    const sin = Math.sin(worldAngle - pixelAngle);
    const scaledP1 = [p1Pixel[0] * scale, p1Pixel[1] * scale];
    const rotatedP1 = [
      scaledP1[0] * cos - scaledP1[1] * sin,
      scaledP1[0] * sin + scaledP1[1] * cos
    ];
    const offset: [number, number] = [p1World[0] - rotatedP1[0], p1World[1] - rotatedP1[1]];

    return { scale, rotation, offset };
  }

  // For 3+ points, use least squares (simplified to average for now)
  // TODO: Implement proper least squares fitting for better accuracy
  let totalScale = 0;
  let totalRotation = 0;
  let count = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const pixelDist = Math.hypot(p2.pixel[0] - p1.pixel[0], p2.pixel[1] - p1.pixel[1]);
    const worldDist = Math.hypot(p2.world[0] - p1.world[0], p2.world[1] - p1.world[1]);

    if (pixelDist > 0 && worldDist > 0) {
      totalScale += worldDist / pixelDist;

      const pixelAngle = Math.atan2(p2.pixel[1] - p1.pixel[1], p2.pixel[0] - p1.pixel[0]);
      const worldAngle = Math.atan2(p2.world[1] - p1.world[1], p2.world[0] - p1.world[0]);
      totalRotation += worldAngle - pixelAngle;

      count++;
    }
  }

  const scale = totalScale / count;
  const rotation = (totalRotation / count) * (180 / Math.PI);

  // Calculate offset from first point
  const p1 = points[0];
  const cos = Math.cos((totalRotation / count));
  const sin = Math.sin((totalRotation / count));
  const scaledP1 = [p1.pixel[0] * scale, p1.pixel[1] * scale];
  const rotatedP1 = [
    scaledP1[0] * cos - scaledP1[1] * sin,
    scaledP1[0] * sin + scaledP1[1] * cos
  ];
  const offset: [number, number] = [p1.world[0] - rotatedP1[0], p1.world[1] - rotatedP1[1]];

  return { scale, rotation, offset };
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = CalibrateImportRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid calibration request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data;

  try {
    const { scale, rotation, offset } = calculateCalibration(body.points);

    const calibration: ImportCalibration = {
      points: body.points,
      scale,
      rotation,
      offset,
      unit: body.unit
    };

    const response: CalibrateImportResponse = {
      calibration,
      success: true
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to calculate calibration.";
    return apiError(message, 400, "CALIBRATION_FAILED");
  }
}
