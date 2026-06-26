import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import type { RemixLayoutPriority } from "@/lib/retained-structure/remix-parameters";

export interface LayoutOptimizationOptions {
  layoutPriority?: RemixLayoutPriority;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutBounds {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rectCentroid(rect: LayoutRect): [number, number] {
  return [rect.x + rect.width / 2, rect.y + rect.height / 2];
}

function rectsGap(a: LayoutRect, b: LayoutRect) {
  const dx = Math.max(0, Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width)));
  const dy = Math.max(0, Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height)));
  return Math.hypot(dx, dy);
}

function overlapVector(a: LayoutRect, b: LayoutRect) {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

  if (overlapX <= 0 || overlapY <= 0) {
    return null;
  }

  if (overlapX < overlapY) {
    const direction = rectCentroid(a)[0] < rectCentroid(b)[0] ? -1 : 1;
    return { dx: direction * (overlapX + 0.08), dy: 0 };
  }

  const direction = rectCentroid(a)[1] < rectCentroid(b)[1] ? -1 : 1;
  return { dx: 0, dy: direction * (overlapY + 0.08) };
}

function clampRect(rect: LayoutRect, bounds: LayoutBounds): LayoutRect {
  const width = Math.min(rect.width, bounds.width);
  const height = Math.min(rect.height, bounds.height);

  return {
    x: clamp(rect.x, 0, Math.max(0, bounds.width - width)),
    y: clamp(rect.y, 0, Math.max(0, bounds.height - height)),
    width,
    height
  };
}

export function resolveRectOverlaps(rects: Map<string, LayoutRect>, bounds: LayoutBounds, iterations = 24) {
  const ids = [...rects.keys()];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let moved = false;

    for (let leftIndex = 0; leftIndex < ids.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < ids.length; rightIndex += 1) {
        const leftId = ids[leftIndex];
        const rightId = ids[rightIndex];
        const leftRect = rects.get(leftId);
        const rightRect = rects.get(rightId);

        if (!leftRect || !rightRect) {
          continue;
        }

        const separation = overlapVector(leftRect, rightRect);
        if (!separation) {
          continue;
        }

        moved = true;
        rects.set(leftId, clampRect({ ...leftRect, x: leftRect.x + separation.dx, y: leftRect.y + separation.dy }, bounds));
        rects.set(
          rightId,
          clampRect(
            { ...rightRect, x: rightRect.x - separation.dx, y: rightRect.y - separation.dy },
            bounds
          )
        );
      }
    }

    if (!moved) {
      break;
    }
  }
}

export function applyAdjacencyForces(
  rects: Map<string, LayoutRect>,
  topology: Pick<PlanTopologyVersion, "edges">,
  bounds: LayoutBounds,
  iterations = 10
) {
  const ids = [...rects.keys()];

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = new Map<string, { dx: number; dy: number }>();
    ids.forEach((id) => forces.set(id, { dx: 0, dy: 0 }));

    topology.edges.forEach((edge) => {
      if (edge.relationship === "separated") {
        return;
      }

      const fromRect = rects.get(edge.from);
      const toRect = rects.get(edge.to);
      if (!fromRect || !toRect) {
        return;
      }

      const gap = rectsGap(fromRect, toRect);
      if (gap <= 0.35) {
        return;
      }

      const [ax, ay] = rectCentroid(fromRect);
      const [bx, by] = rectCentroid(toRect);
      const distance = Math.hypot(bx - ax, by - ay) || 1;
      const strength = Math.min(gap * 0.24, 2.1);
      const fx = ((bx - ax) / distance) * strength;
      const fy = ((by - ay) / distance) * strength;
      const fromForce = forces.get(edge.from)!;
      const toForce = forces.get(edge.to)!;
      fromForce.dx += fx;
      fromForce.dy += fy;
      toForce.dx -= fx;
      toForce.dy -= fy;
    });

    ids.forEach((id) => {
      const rect = rects.get(id);
      const force = forces.get(id);
      if (!rect || !force) {
        return;
      }

      rects.set(
        id,
        clampRect(
          {
            x: rect.x + force.dx,
            y: rect.y + force.dy,
            width: rect.width,
            height: rect.height
          },
          bounds
        )
      );
    });
  }
}

export function optimizeLayoutRects(
  rects: Map<string, LayoutRect>,
  topology: Pick<PlanTopologyVersion, "edges" | "rooms">,
  bounds: LayoutBounds,
  options: LayoutOptimizationOptions = {}
) {
  const priority = options.layoutPriority ?? "daylight";
  const adjacencyIterations = priority === "circulation" ? 14 : priority === "area-efficiency" ? 4 : 8;
  const overlapIterations = priority === "area-efficiency" ? 36 : priority === "circulation" ? 18 : 28;

  applyAdjacencyForces(rects, topology, bounds, adjacencyIterations);
  resolveRectOverlaps(rects, bounds, overlapIterations);
  applyAdjacencyForces(rects, topology, bounds, Math.max(2, Math.round(adjacencyIterations / 2)));
  resolveRectOverlaps(rects, bounds, Math.max(8, Math.round(overlapIterations / 2)));
}
