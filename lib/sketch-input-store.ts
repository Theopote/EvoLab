import { create } from "zustand";
import type { Point } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";
import { processSketchStrokes, type ProcessedLoop } from "@/lib/sketch-processing";

export interface GhostLoop extends ProcessedLoop {
  id: string;
}

interface SketchInputStore {
  strokes: Point[][];
  activeStroke: Point[];
  ghostLoops: GhostLoop[];
  beginStroke: (point: Point) => void;
  extendStroke: (point: Point) => void;
  endStroke: () => void;
  recomputeGhostLoops: () => void;
  clearSketch: () => void;
}

function ghostId(polygon: Point[], index: number) {
  const signature = polygon
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join("|");
  return `ghost-${index}-${signature}`;
}

function buildGhostLoops(strokes: Point[][]) {
  const loops = processSketchStrokes(strokes);

  return loops.map((loop, index) => ({
    ...loop,
    id: ghostId(loop.polygon, index)
  }));
}

export const useSketchInputStore = create<SketchInputStore>((set, get) => ({
  strokes: [],
  activeStroke: [],
  ghostLoops: [],
  beginStroke: (point) => set({ activeStroke: [point] }),
  extendStroke: (point) =>
    set((state) => ({
      activeStroke: state.activeStroke.length ? [...state.activeStroke, point] : [point]
    })),
  endStroke: () => {
    const { activeStroke, strokes } = get();

    if (activeStroke.length < 2) {
      set({ activeStroke: [] });
      return;
    }

    const nextStrokes = [...strokes, activeStroke];

    set({
      strokes: nextStrokes,
      activeStroke: [],
      ghostLoops: buildGhostLoops(nextStrokes)
    });
  },
  recomputeGhostLoops: () => {
    const { strokes } = get();
    set({ ghostLoops: buildGhostLoops(strokes) });
  },
  clearSketch: () => set({ strokes: [], activeStroke: [], ghostLoops: [] })
}));
