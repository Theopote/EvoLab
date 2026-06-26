import { create } from "zustand";

export type RenderReferenceCapturePass = "depth" | "line";
export type RenderReferenceCaptureMode = RenderReferenceCapturePass | "both";

export interface RenderReferenceCaptureResult {
  depth?: string;
  line?: string;
}

interface RenderReferenceCaptureRequest {
  cameraView: string;
  modes: RenderReferenceCapturePass[];
}

interface RenderReferenceCaptureStore {
  status: "idle" | "capturing" | "done" | "error";
  capturePass: RenderReferenceCapturePass | null;
  request: RenderReferenceCaptureRequest | null;
  results: RenderReferenceCaptureResult;
  error?: string;
  requestCapture: (cameraView: string, mode: RenderReferenceCaptureMode) => void;
  setCapturePass: (pass: RenderReferenceCapturePass) => void;
  completeCapture: (results: RenderReferenceCaptureResult) => void;
  failCapture: (message: string) => void;
  resetCapture: () => void;
}

function modesForCapture(mode: RenderReferenceCaptureMode): RenderReferenceCapturePass[] {
  if (mode === "both") {
    return ["depth", "line"];
  }

  return [mode];
}

export const useRenderReferenceCaptureStore = create<RenderReferenceCaptureStore>((set) => ({
  status: "idle",
  capturePass: null,
  request: null,
  results: {},
  error: undefined,
  requestCapture: (cameraView, mode) =>
    set({
      status: "capturing",
      capturePass: modesForCapture(mode)[0] ?? null,
      request: {
        cameraView,
        modes: modesForCapture(mode)
      },
      results: {},
      error: undefined
    }),
  setCapturePass: (pass) => set({ capturePass: pass }),
  completeCapture: (results) =>
    set({
      status: "done",
      results,
      capturePass: null,
      error: undefined
    }),
  failCapture: (message) =>
    set({
      status: "error",
      error: message,
      capturePass: null
    }),
  resetCapture: () =>
    set({
      status: "idle",
      capturePass: null,
      request: null,
      results: {},
      error: undefined
    })
}));
