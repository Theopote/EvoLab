import { PDFParse } from "pdf-parse";
import type { RecognizedLevelGraph, RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";
import type { Point } from "@/lib/project-types";

const dimensionPattern = /(\d+(?:\.\d+)?)\s*(?:m|mm|cm)?/i;
const roomNamePattern =
  /^(lobby|corridor|office|bedroom|kitchen|bathroom|stair|elevator|living(?:\s*room)?|ward|consultation|门厅|走廊|办公|卧室|厨房|卫|楼梯|电梯).*/i;

function parseDimensionMeters(text: string) {
  const match = text.match(dimensionPattern);

  if (!match) {
    return undefined;
  }

  let meters = Number(match[1]);

  if (/mm/i.test(text)) {
    meters /= 1000;
  } else if (/cm/i.test(text)) {
    meters /= 100;
  }

  return meters > 0 ? meters : undefined;
}

function buildSyntheticWallsFromText(lines: string[]): RecognizedPlanGraph["levels"][number]["walls"] {
  const roomLines = lines.filter((line) => roomNamePattern.test(line.trim()));

  if (roomLines.length < 2) {
    return [];
  }

  const width = Math.max(6, roomLines.length * 4);
  const height = Math.max(6, Math.ceil(roomLines.length / 2) * 4);

  return [
    { id: "pdf-wall-n", start: [0, 0] as Point, end: [width, 0] as Point, type: "external" as const },
    { id: "pdf-wall-e", start: [width, 0] as Point, end: [width, height] as Point, type: "external" as const },
    { id: "pdf-wall-s", start: [width, height] as Point, end: [0, height] as Point, type: "external" as const },
    { id: "pdf-wall-w", start: [0, height] as Point, end: [0, 0] as Point, type: "external" as const }
  ];
}

function buildRoomLabels(lines: string[], pageIndex: number) {
  return lines
    .filter((line: string) => roomNamePattern.test(line))
    .map((line: string, index: number) => ({
      name: line,
      center: [(index % 3) * 120 + 60, Math.floor(index / 3) * 120 + 60 + pageIndex * 24] as Point
    }));
}

function buildDimensionAnnotations(lines: string[]) {
  return lines
    .map((line: string, index: number) => {
      const meters = parseDimensionMeters(line);

      if (!meters) {
        return undefined;
      }

      const y = index * 40 + 20;

      return {
        text: line,
        start: [20, y] as Point,
        end: [20 + meters * 40, y] as Point
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function buildPdfLevel(pageText: string, pageIndex: number): RecognizedLevelGraph {
  const lines = pageText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean);

  return {
    name: `PDF Level ${String(pageIndex + 1).padStart(2, "0")}`,
    walls: buildSyntheticWallsFromText(lines),
    openings: [],
    roomPolygons: [],
    roomLabels: buildRoomLabels(lines, pageIndex),
    dimensionAnnotations: buildDimensionAnnotations(lines)
  };
}

export function shouldFallbackPdfToVision(graph: RecognizedPlanGraph) {
  const totalWalls = graph.levels.reduce((sum, level) => sum + level.walls.length, 0);
  const totalRoomLabels = graph.levels.reduce((sum, level) => sum + level.roomLabels.length, 0);
  const totalDimensions = graph.levels.reduce((sum, level) => sum + level.dimensionAnnotations.length, 0);

  return totalWalls < 4 && totalRoomLabels < 2 && totalDimensions === 0;
}

export async function renderPdfPageToImage(
  buffer: Buffer,
  pageNumber = 1
): Promise<{ base64: string; mediaType: "image/png"; byteLength: number; fileName: string }> {
  const parser = new PDFParse({ data: buffer });

  try {
    const screenshot = await parser.getScreenshot({
      partial: [pageNumber],
      desiredWidth: 1600,
      imageDataUrl: true,
      imageBuffer: true
    });
    const page = screenshot.pages[0];

    if (!page?.dataUrl) {
      throw new Error("Unable to render PDF page preview.");
    }

    const base64 = page.dataUrl.replace(/^data:image\/png;base64,/i, "");

    return {
      base64,
      mediaType: "image/png",
      byteLength: page.data.byteLength,
      fileName: `pdf-page-${pageNumber}.png`
    };
  } finally {
    await parser.destroy();
  }
}

export async function parsePdfToGraph(buffer: Buffer): Promise<RecognizedPlanGraph> {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const levels = parsed.pages
      .map((page) => buildPdfLevel(page.text, page.num - 1))
      .filter(
        (level) =>
          level.walls.length > 0 || level.roomLabels.length > 0 || level.dimensionAnnotations.length > 0
      );
    const warnings: string[] = [
      "PDF import used text-layer parsing. Explicit vector wall geometry is not parsed yet; inferred walls remain approximate."
    ];
    const firstDimension = levels.flatMap((level) => level.dimensionAnnotations)[0];

    if (!levels.length) {
      warnings.push("No usable PDF text-layer content was found.");
    }

    if (!levels.some((level) => level.roomLabels.length > 0)) {
      warnings.push("No recognizable room names found in PDF text layer.");
    }

    return {
      scale: firstDimension
        ? {
            pixelsPerMeter: 40,
            referenceDimensionMeters: parseDimensionMeters(firstDimension.text)
          }
        : undefined,
      levels: levels.length
        ? levels
        : [
            {
              name: "PDF Level 01",
              walls: [],
              openings: [],
              roomPolygons: [],
              roomLabels: [],
              dimensionAnnotations: []
            }
          ],
      warnings
    };
  } finally {
    await parser.destroy();
  }
}
