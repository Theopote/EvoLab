import { PDFParse } from "pdf-parse";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy, TextItem } from "pdfjs-dist/types/src/display/api";
import type { RecognizedLevelGraph, RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";
import type { Point } from "@/lib/project-types";

const dimensionPattern = /(\d+(?:\.\d+)?)\s*(?:m|mm|cm)?/i;
const roomNamePattern =
  /^(lobby|corridor|office|bedroom|kitchen|bathroom|stair|elevator|living(?:\s*room)?|ward|consultation|门厅|走廊|办公|卧室|厨房|卫|楼梯|电梯).*/i;
const minimumWallLength = 12;
const maxWallThickness = 40;
const wallRectAspectRatio = 3;
const paintOps = new Set<number>();
const pathMoveTo = 0;
const pathLineTo = 1;
const pathCurveTo = 2;
const pathClose = 3;

paintOps.add(pdfjs.OPS.stroke);
paintOps.add(pdfjs.OPS.closeStroke);
paintOps.add(pdfjs.OPS.fillStroke);
paintOps.add(pdfjs.OPS.eoFillStroke);
paintOps.add(pdfjs.OPS.closeFillStroke);
paintOps.add(pdfjs.OPS.closeEOFillStroke);

interface PdfOperatorList {
  fnArray: number[];
  argsArray: unknown[];
}

interface PdfPathState {
  lineWidth: number;
  transform: [number, number, number, number, number, number];
}

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

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pointKey(point: Point) {
  return `${round(point[0])},${round(point[1])}`;
}

function lineKey(start: Point, end: Point) {
  const a = pointKey(start);
  const b = pointKey(end);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function multiplyTransform(
  left: [number, number, number, number, number, number],
  right: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ];
}

function transformPoint(point: Point, matrix: [number, number, number, number, number, number]): Point {
  return [
    point[0] * matrix[0] + point[1] * matrix[2] + matrix[4],
    point[0] * matrix[1] + point[1] * matrix[3] + matrix[5]
  ];
}

function matrixScale(matrix: [number, number, number, number, number, number]) {
  const sx = Math.hypot(matrix[0], matrix[1]);
  const sy = Math.hypot(matrix[2], matrix[3]);
  return Math.max(1, (sx + sy) / 2);
}

function normalizePointToViewport(point: Point, viewport: { convertToViewportPoint: (x: number, y: number) => number[] }) {
  const [x, y] = viewport.convertToViewportPoint(point[0], point[1]);
  return [round(x), round(y)] as Point;
}

function asNumberArray(value: unknown): number[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Array.from(value as ArrayLike<number>);
}

function pushSegment(
  segments: Array<{ start: Point; end: Point; thickness: number }>,
  start: Point,
  end: Point,
  thickness: number
) {
  if (distance(start, end) < minimumWallLength) {
    return;
  }

  segments.push({ start, end, thickness });
}

function decodeConstructPathSegments(
  pathDataInput: unknown,
  state: PdfPathState,
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] }
) {
  const segments: Array<{ start: Point; end: Point; thickness: number }> = [];
  const pathData = asNumberArray(pathDataInput);
  let index = 0;
  let currentPoint: Point | undefined;
  let subpathStart: Point | undefined;
  const scaledLineWidth = Math.max(1, state.lineWidth * matrixScale(state.transform));

  while (index < pathData.length) {
    const command = pathData[index++];

    if (command === pathMoveTo) {
      const rawPoint = transformPoint([pathData[index++] ?? 0, pathData[index++] ?? 0], state.transform);
      currentPoint = normalizePointToViewport(rawPoint, viewport);
      subpathStart = currentPoint;
      continue;
    }

    if (command === pathLineTo) {
      const rawPoint = transformPoint([pathData[index++] ?? 0, pathData[index++] ?? 0], state.transform);
      const nextPoint = normalizePointToViewport(rawPoint, viewport);

      if (currentPoint) {
        pushSegment(segments, currentPoint, nextPoint, scaledLineWidth);
      }

      currentPoint = nextPoint;
      continue;
    }

    if (command === pathCurveTo) {
      index += 6;
      continue;
    }

    if (command === pathClose) {
      if (currentPoint && subpathStart) {
        pushSegment(segments, currentPoint, subpathStart, scaledLineWidth);
      }

      currentPoint = subpathStart;
      continue;
    }
  }

  return segments;
}

function classifyWallType(start: Point, end: Point, pageWidth: number, pageHeight: number) {
  const nearBoundary =
    Math.min(start[0], end[0]) <= pageWidth * 0.05 ||
    Math.min(start[1], end[1]) <= pageHeight * 0.05 ||
    Math.max(start[0], end[0]) >= pageWidth * 0.95 ||
    Math.max(start[1], end[1]) >= pageHeight * 0.95;

  return nearBoundary ? "external" : "internal";
}

function rectangleToCenterline(
  x: number,
  y: number,
  width: number,
  height: number,
  state: PdfPathState,
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] }
) {
  const absWidth = Math.abs(width);
  const absHeight = Math.abs(height);
  const longSide = Math.max(absWidth, absHeight);
  const shortSide = Math.min(absWidth, absHeight);

  if (longSide < minimumWallLength || shortSide <= 0 || shortSide > maxWallThickness) {
    return undefined;
  }

  if (longSide / shortSide < wallRectAspectRatio) {
    return undefined;
  }

  const horizontal = absWidth >= absHeight;
  const startRaw = horizontal ? ([x, y + height / 2] as Point) : ([x + width / 2, y] as Point);
  const endRaw = horizontal ? ([x + width, y + height / 2] as Point) : ([x + width / 2, y + height] as Point);
  const start = normalizePointToViewport(transformPoint(startRaw, state.transform), viewport);
  const end = normalizePointToViewport(transformPoint(endRaw, state.transform), viewport);

  if (distance(start, end) < minimumWallLength) {
    return undefined;
  }

  return {
    start,
    end,
    thickness: round(shortSide * matrixScale(state.transform))
  };
}

export function extractWallsFromPdfOperatorList(
  operatorList: PdfOperatorList,
  pageWidth: number,
  pageHeight: number,
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] }
) {
  const walls: RecognizedLevelGraph["walls"] = [];
  const wallByKey = new Map<string, (typeof walls)[number]>();
  const stack: PdfPathState[] = [];
  let state: PdfPathState = {
    lineWidth: 1,
    transform: [1, 0, 0, 1, 0, 0]
  };

  operatorList.fnArray.forEach((fn, opIndex) => {
    const args = (operatorList.argsArray[opIndex] as unknown[]) ?? [];

    if (fn === pdfjs.OPS.save) {
      stack.push({
        lineWidth: state.lineWidth,
        transform: [...state.transform] as PdfPathState["transform"]
      });
      return;
    }

    if (fn === pdfjs.OPS.restore) {
      state = stack.pop() ?? state;
      return;
    }

    if (fn === pdfjs.OPS.transform) {
      const values = args as number[];

      if (values.length >= 6) {
        state = {
          ...state,
          transform: multiplyTransform(state.transform, [
            values[0] ?? 1,
            values[1] ?? 0,
            values[2] ?? 0,
            values[3] ?? 1,
            values[4] ?? 0,
            values[5] ?? 0
          ])
        };
      }

      return;
    }

    if (fn === pdfjs.OPS.setLineWidth) {
      state = {
        ...state,
        lineWidth: Number((args as number[])[0] ?? 1)
      };
      return;
    }

    if (fn !== pdfjs.OPS.constructPath) {
      return;
    }

    const paintOp = Number(args[0]);
    const pathPayload = (args as [number, unknown])[1];

    if (!paintOps.has(paintOp)) {
      return;
    }

    const decodedSegments = decodeConstructPathSegments(pathPayload, state, viewport);

    decodedSegments.forEach((segment) => {
      const key = lineKey(segment.start, segment.end);

      if (wallByKey.has(key)) {
        return;
      }

      const wall = {
        id: `pdf-wall-${walls.length + 1}`,
        start: segment.start,
        end: segment.end,
        thickness: round(Math.min(maxWallThickness, Math.max(1, segment.thickness))),
        type: classifyWallType(segment.start, segment.end, pageWidth, pageHeight)
      } as const;

      wallByKey.set(key, wall);
      walls.push(wall);
    });

    if (paintOp === pdfjs.OPS.stroke || paintOp === pdfjs.OPS.closeStroke) {
      return;
    }

    const bbox = asNumberArray((args as [number, unknown, unknown])[2]);

    if (bbox.length >= 4) {
      const rectangleWall = rectangleToCenterline(
        bbox[0] ?? 0,
        bbox[1] ?? 0,
        (bbox[2] ?? 0) - (bbox[0] ?? 0),
        (bbox[3] ?? 0) - (bbox[1] ?? 0),
        state,
        viewport
      );

      if (rectangleWall) {
        const key = lineKey(rectangleWall.start, rectangleWall.end);

        if (!wallByKey.has(key)) {
          const wall = {
            id: `pdf-wall-${walls.length + 1}`,
            start: rectangleWall.start,
            end: rectangleWall.end,
            thickness: rectangleWall.thickness,
            type: classifyWallType(rectangleWall.start, rectangleWall.end, pageWidth, pageHeight)
          } as const;

          wallByKey.set(key, wall);
          walls.push(wall);
        }
      }
    }
  });

  return walls;
}

function buildRoomLabels(items: TextItem[], viewport: { convertToViewportPoint: (x: number, y: number) => number[] }) {
  return items
    .map((item) => {
      const text = item.str.trim();

      if (!roomNamePattern.test(text)) {
        return undefined;
      }

      const [x, y] = viewport.convertToViewportPoint(item.transform[4] ?? 0, item.transform[5] ?? 0);

      return {
        name: text,
        center: [round(x), round(y)] as Point
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function buildDimensionAnnotations(
  items: TextItem[],
  viewport: { convertToViewportPoint: (x: number, y: number) => number[] }
) {
  return items
    .map((item) => {
      const text = item.str.trim();
      const meters = parseDimensionMeters(text);

      if (!meters) {
        return undefined;
      }

      const [x, y] = viewport.convertToViewportPoint(item.transform[4] ?? 0, item.transform[5] ?? 0);
      const width = Math.max(20, item.width ?? meters * 40);

      return {
        text,
        start: [round(x), round(y)] as Point,
        end: [round(x + width), round(y)] as Point
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function isPdfTextItem(item: unknown): item is TextItem {
  if (!item || typeof item !== "object") {
    return false;
  }

  const candidate = item as Partial<TextItem>;
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

async function buildPdfLevel(page: PDFPageProxy) {
  const viewport = page.getViewport({ scale: 1 });
  const [textContent, operatorList] = await Promise.all([
    page.getTextContent({
      includeMarkedContent: false,
      disableNormalization: false
    }),
    page.getOperatorList()
  ]);
  const items = textContent.items.filter(isPdfTextItem);

  return {
    name: `PDF Level ${String(page.pageNumber).padStart(2, "0")}`,
    walls: extractWallsFromPdfOperatorList(
      operatorList as PdfOperatorList,
      viewport.width,
      viewport.height,
      viewport
    ),
    openings: [],
    roomPolygons: [],
    roomLabels: buildRoomLabels(items, viewport),
    dimensionAnnotations: buildDimensionAnnotations(items, viewport)
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
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: pdfjs.VerbosityLevel.ERRORS,
    stopAtErrors: false
  });

  try {
    const document = await loadingTask.promise;
    const levels: RecognizedLevelGraph[] = [];

    for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex += 1) {
      const page = await document.getPage(pageIndex);
      const level = await buildPdfLevel(page);
      page.cleanup();

      if (level.walls.length > 0 || level.roomLabels.length > 0 || level.dimensionAnnotations.length > 0) {
        levels.push(level);
      }
    }

    const warnings: string[] = [
      "PDF import parsed vector path operators and text positions directly from the page content stream."
    ];
    const firstDimension = levels.flatMap((level) => level.dimensionAnnotations)[0];

    if (!levels.length) {
      warnings.push("No usable vector or text content was found in the PDF.");
    }

    if (!levels.some((level) => level.roomLabels.length > 0)) {
      warnings.push("No recognizable room names found in PDF text layer.");
    }

    if (!levels.some((level) => level.walls.length > 0)) {
      warnings.push("No vector wall candidates were found in the PDF operators.");
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
    await loadingTask.destroy();
  }
}
