import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

const coreTypes = new Set(["stair", "elevator", "shaft"]);

const centroid = (polygon: Array<[number, number]>) => {
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length] as [number, number];
};

const distanceToNearestGridIntersection = (
  point: [number, number],
  gridLines: Array<{ axis: string; start: [number, number] }>
) => {
  const xLines = [...new Set(gridLines.filter((line) => line.axis === "x").map((line) => line.start[0]))];
  const yLines = [...new Set(gridLines.filter((line) => line.axis === "y").map((line) => line.start[1]))];

  if (xLines.length === 0 || yLines.length === 0) {
    return Infinity;
  }

  return Math.min(
    ...xLines.flatMap((x) => yLines.map((y) => Math.hypot(point[0] - x, point[1] - y)))
  );
};

export const scoreStructureFit = (context: ScoringContext): MetricResult => {
  const grid = context.version.building?.grids?.[0];
  const coreRooms = context.version.rooms.filter((room) => coreTypes.has(room.type));
  const largeRooms = context.version.rooms.filter((room) => room.areaSqm >= 80 && !coreTypes.has(room.type));

  if (!grid?.lines.length) {
    return {
      score: 70,
      summary: "No structural grid defined; using neutral structure-fit estimate.",
      evidence: [{ label: "Grid", value: "not defined", impact: "neutral" }]
    };
  }

  const axisGridLines = grid.lines.filter((line) => line.axis === "x" || line.axis === "y");

  const coreAlignments = coreRooms.map((room) => {
    const center = centroid(room.polygon);
    const offset = distanceToNearestGridIntersection(center, axisGridLines);
    return { room, offset };
  });

  const averageCoreOffset =
    coreAlignments.length > 0
      ? coreAlignments.reduce((total, item) => total + item.offset, 0) / coreAlignments.length
      : 0;

  const spanScores = largeRooms.map((room) => {
    const xs = room.polygon.map(([x]) => x);
    const ys = room.polygon.map(([, y]) => y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const idealMax = 12;
    return span <= idealMax ? 100 : Math.max(40, 100 - ((span - idealMax) / idealMax) * 35);
  });

  const spanAverage = spanScores.length > 0 ? spanScores.reduce((a, b) => a + b, 0) / spanScores.length : 85;
  const coreScore = clampScore(100 - averageCoreOffset * 8);
  const score = clampScore(coreScore * 0.55 + spanAverage * 0.45);

  return {
    score,
    summary: `Core offset to grid avg ${round1(averageCoreOffset)}m; ${largeRooms.length} large-span room(s) checked.`,
    evidence: [
      { label: "Core-grid offset", value: `${round1(averageCoreOffset)}m`, impact: averageCoreOffset <= 1.5 ? "positive" : "negative" },
      { label: "Large rooms", value: String(largeRooms.length) },
      { label: "Span score", value: String(Math.round(spanAverage)) }
    ]
  };
};
