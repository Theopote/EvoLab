import DxfParser from "dxf-parser";
import type { RecognizedLevelGraph, RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";
import type { Point } from "@/lib/project-types";

interface DxfEntity {
  type: string;
  layer?: string;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  vertices?: Array<{ x: number; y: number }>;
  position?: { x: number; y: number };
  startPoint?: { x: number; y: number };
  text?: string;
  name?: string;
  x?: number;
  y?: number;
}

const wallLayerPattern = /wall|墙|A-WALL|A_WALL|PARTITION/i;
const openingBlockPattern = /door|window|opening|门|窗|DR|WIN/i;
const ignoredLayerPattern = /dim|text|anno|hatch|furniture|家私|标注/i;

function toPoint(x: number, y: number): Point {
  return [x, y];
}

function isWallLayer(layer?: string) {
  return Boolean(layer && wallLayerPattern.test(layer) && !ignoredLayerPattern.test(layer));
}

function isOpeningBlock(name?: string) {
  return Boolean(name && openingBlockPattern.test(name));
}

function collectWallSegments(entities: DxfEntity[]) {
  const walls: RecognizedLevelGraph["walls"] = [];
  let wallIndex = 1;

  entities.forEach((entity) => {
    if (entity.type === "LINE" && isWallLayer(entity.layer)) {
      const start = entity.start ?? entity.vertices?.[0];
      const end = entity.end ?? entity.vertices?.[1];

      if (!start || !end) {
        return;
      }

      walls.push({
        id: `dxf-wall-${wallIndex++}`,
        start: toPoint(start.x, start.y),
        end: toPoint(end.x, end.y),
        type: /ext|外墙|outer/i.test(entity.layer ?? "") ? "external" : "internal"
      });
      return;
    }

    if ((entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") && entity.vertices?.length) {
      if (!isWallLayer(entity.layer)) {
        return;
      }

      for (let index = 0; index < entity.vertices.length - 1; index += 1) {
        const start = entity.vertices[index];
        const end = entity.vertices[index + 1];

        walls.push({
          id: `dxf-wall-${wallIndex++}`,
          start: toPoint(start.x, start.y),
          end: toPoint(end.x, end.y),
          type: "internal"
        });
      }
    }
  });

  return walls;
}

function collectOpenings(entities: DxfEntity[]) {
  const openings: RecognizedLevelGraph["openings"] = [];
  let openingIndex = 1;

  entities.forEach((entity) => {
    if (entity.type !== "INSERT") {
      return;
    }

    const blockName = entity.name ?? "";
    const x = entity.position?.x ?? entity.startPoint?.x ?? entity.x ?? 0;
    const y = entity.position?.y ?? entity.startPoint?.y ?? entity.y ?? 0;

    if (!isOpeningBlock(blockName)) {
      return;
    }

    openings.push({
      id: `dxf-opening-${openingIndex++}`,
      type: /window|窗|WIN/i.test(blockName) ? "window" : "door",
      center: toPoint(x, y),
      width: /window|窗/i.test(blockName) ? 1.2 : 0.9
    });
  });

  return openings;
}

function collectRoomLabels(entities: DxfEntity[]) {
  const labels: RecognizedLevelGraph["roomLabels"] = [];

  entities.forEach((entity) => {
    if (entity.type !== "TEXT" && entity.type !== "MTEXT") {
      return;
    }

    const text = entity.text?.trim();

    if (!text || text.length > 40 || /^[\d.]+/.test(text)) {
      return;
    }

    const x = entity.position?.x ?? entity.startPoint?.x ?? entity.x ?? 0;
    const y = entity.position?.y ?? entity.startPoint?.y ?? entity.y ?? 0;

    labels.push({
      name: text,
      center: toPoint(x, y)
    });
  });

  return labels;
}

export function parseDxfToGraph(dxfText: string): RecognizedPlanGraph {
  const parser = new DxfParser();
  const parsed = parser.parseSync(dxfText) as { entities?: DxfEntity[] } | null;

  if (!parsed?.entities?.length) {
    throw new Error("DXF file did not contain recognizable entities.");
  }

  const walls = collectWallSegments(parsed.entities);
  const openings = collectOpenings(parsed.entities);
  const roomLabels = collectRoomLabels(parsed.entities);
  const warnings: string[] = [];

  if (!walls.length) {
    warnings.push("No wall layers detected. Falling back to all LINE entities as walls.");
    parsed.entities
      .filter((entity) => entity.type === "LINE")
      .forEach((entity, index) => {
        const start = entity.start ?? entity.vertices?.[0];
        const end = entity.end ?? entity.vertices?.[1];

        if (!start || !end) {
          return;
        }

        walls.push({
          id: `dxf-line-${index + 1}`,
          start: toPoint(start.x, start.y),
          end: toPoint(end.x, end.y),
          type: "partition"
        });
      });
  }

  if (!roomLabels.length) {
    warnings.push("No room text labels found in DXF.");
  }

  return {
    levels: [
      {
        name: "DXF Level 01",
        walls,
        openings,
        roomPolygons: [],
        roomLabels,
        dimensionAnnotations: []
      }
    ],
    warnings
  };
}
