export interface CaptureViewDefinition {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
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
      target: [0, height * 0.35, 0]
    },
    {
      id: "eye",
      label: "Eye Level",
      position: [0, height * 0.55, distance * 1.1],
      target: [0, height * 0.22, 0]
    },
    {
      id: "plan",
      label: "Plan View",
      position: [0.1, distance * 1.35, 0.1],
      target: [0, 0, 0]
    }
  ];
}
