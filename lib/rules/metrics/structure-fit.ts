import { buildStructuralSystem } from "@/lib/project-domain";
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

const roomSpan = (room: { polygon: Array<[number, number]> }) => {
  const xs = room.polygon.map(([x]) => x);
  const ys = room.polygon.map(([, y]) => y);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

const modularFitScore = (span: number, module: number) => {
  if (module <= 0) {
    return 85;
  }

  const remainder = span % module;
  const offset = Math.min(remainder, module - remainder);
  return clampScore(100 - (offset / module) * 40);
};

export const scoreStructureFit = (context: ScoringContext): MetricResult => {
  const version = context.version;
  const scopedLevel = context.levelId ? version.levels.find((level) => level.id === context.levelId) : undefined;

  if (scopedLevel?.isTransferFloor) {
    const grossArea = version.rooms.reduce((total, room) => total + room.areaSqm, 0);
    const coreRooms = version.rooms.filter((room) => coreTypes.has(room.type));
    const coreRatio = grossArea > 0 ? coreRooms.reduce((total, room) => total + room.areaSqm, 0) / grossArea : 0;

    return {
      score: clampScore(78 + Math.min(12, coreRatio * 40)),
      summary: `${scopedLevel.name} is a transfer floor; grid alignment uses relaxed structural scoring.`,
      evidence: [
        { label: "Transfer floor", value: scopedLevel.name, impact: "neutral" },
        { label: "Core ratio", value: `${round1(coreRatio * 100)}%`, impact: "neutral" }
      ],
      hints: ["Transfer floors may intentionally offset columns and cores from the floors above/below."]
    };
  }

  const structural = buildStructuralSystem(version);
  const grid = version.building?.grids?.[0];
  const coreRooms = version.rooms.filter((room) => coreTypes.has(room.type));
  const largeRooms = version.rooms.filter((room) => room.areaSqm >= 80 && !coreTypes.has(room.type));
  const grossArea = version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const coreArea = coreRooms.reduce((total, room) => total + room.areaSqm, 0);
  const coreRatio = grossArea > 0 ? coreArea / grossArea : 0;
  const idealCoreRatio = 0.12;
  const coreEfficiencyScore = clampScore(100 - Math.abs(coreRatio - idealCoreRatio) / idealCoreRatio * 45);

  if (!grid?.lines.length) {
    return {
      score: clampScore(coreEfficiencyScore * 0.4 + 62),
      summary: `No structural grid defined; core area ratio ${round1(coreRatio * 100)}% of floor plate.`,
      evidence: [
        { label: "Grid", value: "not defined", impact: "neutral" },
        { label: "Core ratio", value: `${round1(coreRatio * 100)}%`, impact: Math.abs(coreRatio - idealCoreRatio) <= 0.04 ? "positive" : "neutral" },
        { label: "Max span limit", value: `${round1(structural.maxSpanMeters)}m` }
      ]
    };
  }

  const axisGridLines = grid.lines.filter((line) => line.axis === "x" || line.axis === "y");
  const module = structural.gridSpacingMeters;

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
    const span = roomSpan(room);
    const spanLimitScore =
      span <= structural.maxSpanMeters
        ? 100
        : Math.max(35, 100 - ((span - structural.maxSpanMeters) / structural.maxSpanMeters) * 40);
    const moduleScore = modularFitScore(span, module);
    return spanLimitScore * 0.65 + moduleScore * 0.35;
  });

  const spanAverage = spanScores.length > 0 ? spanScores.reduce((a, b) => a + b, 0) / spanScores.length : 88;
  const coreScore = clampScore(100 - averageCoreOffset * 8);
  const score = clampScore(coreScore * 0.35 + spanAverage * 0.35 + coreEfficiencyScore * 0.3);

  return {
    score,
    summary: `Core-grid offset avg ${round1(averageCoreOffset)}m; ${largeRooms.length} large-span room(s); core ${round1(coreRatio * 100)}% of plate.`,
    evidence: [
      { label: "Core-grid offset", value: `${round1(averageCoreOffset)}m`, impact: averageCoreOffset <= 1.5 ? "positive" : "negative" },
      { label: "Grid module", value: `${round1(module)}m` },
      { label: "Max clear span", value: `${round1(structural.maxSpanMeters)}m` },
      { label: "Large rooms", value: String(largeRooms.length) },
      { label: "Span score", value: String(Math.round(spanAverage)) },
      {
        label: "Core efficiency",
        value: `${round1(coreRatio * 100)}% of gross area`,
        impact: Math.abs(coreRatio - idealCoreRatio) <= 0.04 ? "positive" : "neutral"
      }
    ],
    hints:
      spanScores.some((item) => item < 70)
        ? [`One or more large rooms exceed the ${round1(structural.maxSpanMeters)}m structural span target.`]
        : undefined
  };
};
