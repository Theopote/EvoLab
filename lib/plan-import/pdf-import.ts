import { PDFParse } from "pdf-parse";
import type { RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";
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

export async function parsePdfToGraph(buffer: Buffer): Promise<RecognizedPlanGraph> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  const lines = parsed.text
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter(Boolean);
  const warnings: string[] = [
    "PDF import used text-layer parsing. Vector wall geometry was not available; room layout is approximate."
  ];

  const roomLabels = lines
    .filter((line: string) => roomNamePattern.test(line))
    .map((line: string, index: number) => ({
      name: line,
      center: [(index % 3) * 120 + 60, Math.floor(index / 3) * 120 + 60] as Point
    }));

  const dimensionAnnotations = lines
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

  const walls = buildSyntheticWallsFromText(lines);

  if (!roomLabels.length) {
    warnings.push("No recognizable room names found in PDF text layer.");
  }

  return {
    scale: dimensionAnnotations.length
      ? {
          pixelsPerMeter: 40,
          referenceDimensionMeters: parseDimensionMeters(dimensionAnnotations[0].text)
        }
      : undefined,
    levels: [
      {
        name: "PDF Level 01",
        walls,
        openings: [],
        roomPolygons: [],
        roomLabels,
        dimensionAnnotations
      }
    ],
    warnings
  };
}
