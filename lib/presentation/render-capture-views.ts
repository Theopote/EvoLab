export interface RenderCaptureView {
  position: [number, number, number];
  target: [number, number, number];
}

export function buildRenderCaptureView(cameraView: string, spanMeters: number): RenderCaptureView {
  const span = Math.max(spanMeters, 18);
  const distance = span * 1.15;
  const height = Math.max(span * 0.32, 10);

  const views: Record<string, RenderCaptureView> = {
    "Aerial axonometric": {
      position: [distance, distance * 0.82, distance],
      target: [0, height * 0.35, 0]
    },
    "Entrance eye-level": {
      position: [0, height * 0.55, distance * 1.1],
      target: [0, height * 0.22, 0]
    },
    "Medical street": {
      position: [-distance * 0.85, height * 0.45, distance * 0.6],
      target: [0, height * 0.2, 0]
    },
    "Core perspective": {
      position: [distance * 0.35, height * 0.5, distance * 0.35],
      target: [0, height * 0.25, 0]
    },
    "South facade": {
      position: [0, height * 0.4, distance * 1.25],
      target: [0, height * 0.25, 0]
    }
  };

  return views[cameraView] ?? views["Aerial axonometric"]!;
}

export function slugifyCameraView(cameraView: string): string {
  return cameraView
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const RENDER_CAPTURE_WIDTH = 1280;
export const RENDER_CAPTURE_HEIGHT = 720;
