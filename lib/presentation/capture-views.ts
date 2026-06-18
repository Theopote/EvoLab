export interface CaptureViewDefinition {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
  explodeFactor: number;
}

export function buildCaptureViews(spanMeters: number): CaptureViewDefinition[] {
  const span = Math.max(spanMeters, 18);
  const distance = span * 1.15;
  const height = Math.max(span * 0.32, 10);

  return [
    {
      id: "iso",
      label: "Isometric",
      position: [distance, distance * 0.82, distance],
      target: [0, height * 0.35, 0],
      explodeFactor: 0
    },
    {
      id: "eye",
      label: "Eye Level",
      position: [0, height * 0.55, distance * 1.1],
      target: [0, height * 0.22, 0],
      explodeFactor: 0
    },
    {
      id: "plan",
      label: "Plan View",
      position: [0.1, distance * 1.35, 0.1],
      target: [0, 0, 0],
      explodeFactor: 0
    },
    {
      id: "exploded",
      label: "3D Exploded",
      position: [distance * 1.05, distance * 0.9, distance * 1.05],
      target: [0, height * 0.28, 0],
      explodeFactor: 1
    }
  ];
}
