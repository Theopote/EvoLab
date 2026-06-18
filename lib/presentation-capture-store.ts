import { create } from "zustand";

export interface PresentationCaptureImage {
  id: string;
  label: string;
  dataUrl: string;
}

interface PresentationCaptureStore {
  status: "idle" | "capturing" | "done" | "error";
  images: PresentationCaptureImage[];
  explodeFactor: number;
  error?: string;
  requestCapture: () => void;
  setExplodeFactor: (factor: number) => void;
  completeCapture: (images: PresentationCaptureImage[]) => void;
  failCapture: (message: string) => void;
  resetCapture: () => void;
}

export const usePresentationCaptureStore = create<PresentationCaptureStore>((set) => ({
  status: "idle",
  images: [],
  explodeFactor: 0,
  error: undefined,
  requestCapture: () =>
    set({
      status: "capturing",
      images: [],
      explodeFactor: 0,
      error: undefined
    }),
  setExplodeFactor: (factor) => set({ explodeFactor: factor }),
  completeCapture: (images) =>
    set({
      status: "done",
      images,
      error: undefined,
      explodeFactor: 0
    }),
  failCapture: (message) =>
    set({
      status: "error",
      error: message,
      explodeFactor: 0
    }),
  resetCapture: () =>
    set({
      status: "idle",
      images: [],
      explodeFactor: 0,
      error: undefined
    })
}));
