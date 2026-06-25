import type { FacadeEnvelope, FacadeZone } from "@/lib/building-domain";
import type { Point } from "@/lib/project-types";

export type CardinalEdge = FacadeZone["edge"];

export interface OutlineEdgeSegment {
  edge: CardinalEdge;
  start: Point;
  end: Point;
  length: number;
}

export interface FacadeSegmentOverlay {
  id: string;
  edge: CardinalEdge;
  strategy: FacadeZone["strategy"];
  windowRatio: number;
  start: Point;
  end: Point;
  length: number;
}

const strategyPalette: Record<
  FacadeZone["strategy"],
  { color: string; opacity: number; emissive: string; emissiveIntensity: number }
> = {
  curtain_wall: { color: "#67e8f9", opacity: 0.55, emissive: "#0891b2", emissiveIntensity: 0.35 },
  punched_window: { color: "#86efac", opacity: 0.42, emissive: "#16a34a", emissiveIntensity: 0.25 },
  solid: { color: "#64748b", opacity: 0.72, emissive: "#334155", emissiveIntensity: 0.08 },
  mixed: { color: "#fcd34d", opacity: 0.48, emissive: "#d97706", emissiveIntensity: 0.22 }
};

function polygonCenter(outline: Point[]): Point {
  const total = outline.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point,
    [0, 0] as Point
  );
  return [total[0] / outline.length, total[1] / outline.length];
}

function rotateVector([x, y]: Point, degrees: number): Point {
  const radians = (-degrees * Math.PI) / 180;
  return [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)];
}

export function classifyOutlineEdge(start: Point, end: Point, center: Point, orientationDeg = 0): CardinalEdge {
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const [dx, dy] = rotateVector([midpoint[0] - center[0], midpoint[1] - center[1]], orientationDeg);

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "east" : "west";
  }

  return dy > 0 ? "north" : "south";
}

export function groupOutlineEdges(outline: Point[], orientationDeg = 0): OutlineEdgeSegment[] {
  if (outline.length < 3) {
    return [];
  }

  const center = polygonCenter(outline);

  return outline.map((start, index) => {
    const end = outline[(index + 1) % outline.length];
    const edge = classifyOutlineEdge(start, end, center, orientationDeg);
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    return { edge, start, end, length };
  });
}

export function resolveFacadeZoneForLevel(facade: FacadeEnvelope, levelId: string, edge: CardinalEdge): FacadeZone | undefined {
  return (
    facade.zones.find((zone) => zone.levelId === levelId && zone.edge === edge) ??
    facade.zones.find((zone) => !zone.levelId && zone.edge === edge)
  );
}

export function buildFacadeSegmentOverlays(input: {
  outline: Point[];
  levelId: string;
  facade: FacadeEnvelope;
  orientationDeg?: number;
}): FacadeSegmentOverlay[] {
  const segments = groupOutlineEdges(input.outline, input.orientationDeg ?? 0);

  return segments.map((segment, index) => {
    const zone = resolveFacadeZoneForLevel(input.facade, input.levelId, segment.edge);
    const strategy = zone?.strategy ?? "punched_window";
    const windowRatio = zone?.targetWindowRatio ?? input.facade.defaultWindowRatio;

    return {
      id: `${input.levelId}-${segment.edge}-${index}`,
      edge: segment.edge,
      strategy,
      windowRatio,
      start: segment.start,
      end: segment.end,
      length: segment.length
    };
  });
}

export function facadeStrategyMaterial(strategy: FacadeZone["strategy"]) {
  return strategyPalette[strategy];
}

export function windowSlotsAlongSegment(length: number, windowRatio: number, moduleWidth = 1.5) {
  const targetCoverage = Math.max(0.08, Math.min(0.95, windowRatio));
  const count = Math.max(1, Math.round((length * targetCoverage) / moduleWidth));
  const slotWidth = Math.min(moduleWidth, (length * targetCoverage) / count);
  const gap = count > 1 ? (length - slotWidth * count) / (count + 1) : (length - slotWidth) / 2;

  return Array.from({ length: count }, (_, index) => ({
    centerOffset: gap + slotWidth / 2 + index * (slotWidth + gap),
    width: slotWidth
  }));
}
