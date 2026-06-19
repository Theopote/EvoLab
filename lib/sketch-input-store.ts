import { create } from "zustand";
import type { Point } from "@/lib/project-types";
import { matchSemanticRoomsToGhostLoops } from "@/lib/sketch-recognition";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import { processSketchStrokes, type ProcessedLoop } from "@/lib/sketch-processing";

export interface GhostLoop extends ProcessedLoop {
  id: string;
}

export type SketchRecognitionStatus = "idle" | "pending" | "recognizing" | "ready" | "error";

interface SketchInputStore {
  strokes: Point[][];
  activeStroke: Point[];
  ghostLoops: GhostLoop[];
  semanticRooms: RecognizedSketchRoom[];
  semanticByGhostId: Record<string, RecognizedSketchRoom>;
  recognitionStatus: SketchRecognitionStatus;
  strokeEpoch: number;
  recognitionGeneration: number;
  beginStroke: (point: Point) => void;
  extendStroke: (point: Point) => void;
  endStroke: () => void;
  recomputeGhostLoops: () => void;
  setSemanticRooms: (rooms: RecognizedSketchRoom[]) => void;
  setRecognitionStatus: (status: SketchRecognitionStatus) => void;
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
  semanticRooms: [],
  semanticByGhostId: {},
  recognitionStatus: "idle",
  strokeEpoch: 0,
  recognitionGeneration: 0,
  beginStroke: (point) =>
    set((state) => ({
      activeStroke: [point],
      recognitionGeneration: state.recognitionGeneration + 1,
      recognitionStatus: state.recognitionStatus === "recognizing" ? "pending" : state.recognitionStatus
    })),
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
      ghostLoops: buildGhostLoops(nextStrokes),
      strokeEpoch: get().strokeEpoch + 1,
      recognitionStatus: "pending"
    });
  },
  recomputeGhostLoops: () => {
    const { strokes } = get();
    const ghostLoops = buildGhostLoops(strokes);
    set({
      ghostLoops,
      semanticByGhostId: matchSemanticRoomsToGhostLoops(ghostLoops, get().semanticRooms)
    });
  },
  setSemanticRooms: (semanticRooms) => {
    const ghostLoops = get().ghostLoops;
    set({
      semanticRooms,
      semanticByGhostId: matchSemanticRoomsToGhostLoops(ghostLoops, semanticRooms)
    });
  },
  setRecognitionStatus: (recognitionStatus) => set({ recognitionStatus }),
  clearSketch: () =>
    set({
      strokes: [],
      activeStroke: [],
      ghostLoops: [],
      semanticRooms: [],
      semanticByGhostId: {},
      recognitionStatus: "idle",
      strokeEpoch: 0,
      recognitionGeneration: get().recognitionGeneration + 1
    })
}));
