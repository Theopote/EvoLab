import { captureSketchImage } from "@/lib/sketch-capture";
import type { PlanVersion, Point } from "@/lib/project-types";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import type { GhostLoop } from "@/lib/sketch-input-store";

export const SKETCH_AUTO_RECOGNIZE_DELAY_MS = 1500;

export interface SketchRecognitionResult {
  version: PlanVersion;
  recognizedRooms: RecognizedSketchRoom[];
  warnings: string[];
  fallback: boolean;
}

export async function recognizeSketchInput(options: {
  version: PlanVersion;
  strokes: Point[][];
  ghostLoops: GhostLoop[];
  signal?: AbortSignal;
}): Promise<SketchRecognitionResult> {
  const sketchImageBase64 = await captureSketchImage(options.version, options.strokes, options.ghostLoops);
  const response = await fetch("/api/interpret-sketch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentVersion: options.version,
      closedLoops: options.ghostLoops,
      sketchImageBase64,
      appendRooms: true
    }),
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`interpret-sketch failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    version?: PlanVersion;
    recognizedRooms?: RecognizedSketchRoom[];
    warnings?: string[];
    fallback?: boolean;
  };

  if (!data.version?.rooms) {
    throw new Error("interpret-sketch did not return a complete PlanVersion.");
  }

  return {
    version: data.version,
    recognizedRooms: data.recognizedRooms ?? [],
    warnings: data.warnings ?? [],
    fallback: data.fallback ?? false
  };
}

function polygonCentroid(polygon: Point[]): Point {
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function matchSemanticRoomsToGhostLoops(
  ghostLoops: GhostLoop[],
  recognizedRooms: RecognizedSketchRoom[]
): Record<string, RecognizedSketchRoom> {
  const assignments: Record<string, RecognizedSketchRoom> = {};
  const used = new Set<string>();

  ghostLoops.forEach((loop) => {
    const centroid = polygonCentroid(loop.polygon);
    let best: RecognizedSketchRoom | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;

    recognizedRooms.forEach((entry) => {
      if (used.has(entry.room.id)) {
        return;
      }

      const roomCentroid = polygonCentroid(entry.room.polygon as Point[]);
      const delta = distance(centroid, roomCentroid);

      if (delta < bestDistance) {
        bestDistance = delta;
        best = entry;
      }
    });

    if (best && bestDistance < 6) {
      assignments[loop.id] = best;
      used.add(best.room.id);
    }
  });

  return assignments;
}

export function ghostLoopsSignature(ghostLoops: GhostLoop[]) {
  return ghostLoops.map((loop) => loop.id).join("|");
}
