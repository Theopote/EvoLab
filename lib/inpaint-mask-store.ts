import { create } from "zustand";
import type { Point } from "@/lib/project-types";

interface InpaintMaskStore {
  strokes: Point[][];
  activeStroke: Point[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  beginStroke: (point: Point) => void;
  extendStroke: (point: Point) => void;
  endStroke: () => void;
  clearMask: () => void;
}

export const useInpaintMaskStore = create<InpaintMaskStore>((set, get) => ({
  strokes: [],
  activeStroke: [],
  prompt: "",
  setPrompt: (prompt) => set({ prompt }),
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

    set({
      strokes: [...strokes, activeStroke],
      activeStroke: []
    });
  },
  clearMask: () => set({ strokes: [], activeStroke: [], prompt: "" })
}));
