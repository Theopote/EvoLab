import { create } from "zustand";

export interface PresentationCaptureImage {
  id: string;
  label: string;
  dataUrl: string;
}

interface PresentationCaptureStore {
  status: "idle" | "capturing" | "done" | "error";
  images: PresentationCaptureImage[];
  error?: string;
  requestCapture: () => void;
  completeCapture: (images: PresentationCaptureImage[]) => void;
  failCapture: (message: string) => void;
  resetCapture: () => void;
}

export const usePresentationCaptureStore = create<PresentationCaptureStore>((set) => ({
  status: "idle",
  images: [],
  error: undefined,
  requestCapture: () =>
    set({
      status: "capturing",
      images: [],
      error: undefined
    }),
  completeCapture: (images) =>
    set({
      status: "done",
      images,
      error: undefined
    }),
  failCapture: (message) =>
    set({
      status: "error",
      error: message
    }),
  resetCapture: () =>
    set({
      status: "idle",
      images: [],
      error: undefined
    })
}));
