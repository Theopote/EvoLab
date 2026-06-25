import type { GeometryChangeBurst } from "@/lib/geometry-change-merge";

let pendingGeometryChangeBurst: GeometryChangeBurst | null = null;

export function getPendingGeometryChangeBurst() {
  return pendingGeometryChangeBurst;
}

export function setPendingGeometryChangeBurst(burst: GeometryChangeBurst | null) {
  pendingGeometryChangeBurst = burst;
}

export function resetGeometryChangeBurstForTests() {
  pendingGeometryChangeBurst = null;
}
