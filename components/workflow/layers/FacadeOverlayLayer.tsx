"use client";

import type { FacadeEnvelope } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

const edgeTone: Record<FacadeEnvelope["zones"][number]["strategy"], string> = {
  curtain_wall: "#38bdf8",
  punched_window: "#34d399",
  solid: "#94a3b8",
  mixed: "#fbbf24"
};

interface FacadeOverlayLayerProps {
  version: PlanVersion;
  facadeEnvelope?: FacadeEnvelope;
  levelId?: string;
}

export function FacadeOverlayLayer({ version, facadeEnvelope, levelId }: FacadeOverlayLayerProps) {
  if (!facadeEnvelope) {
    return null;
  }

  const { width, height } = version.overallBounds;
  const zones = facadeEnvelope.zones.filter((zone) => !levelId || zone.levelId === levelId);
  const edgeSegments = {
    north: [
      [0, 0],
      [width, 0]
    ] as const,
    south: [
      [0, height],
      [width, height]
    ] as const,
    east: [
      [width, 0],
      [width, height]
    ] as const,
    west: [
      [0, 0],
      [0, height]
    ] as const
  };

  return (
    <g data-layer="facade-overlay">
      {zones.map((zone) => {
        const segment = edgeSegments[zone.edge];
        return (
          <line
            key={zone.id}
            x1={segment[0][0]}
            y1={segment[0][1]}
            x2={segment[1][0]}
            y2={segment[1][1]}
            stroke={edgeTone[zone.strategy]}
            strokeLinecap="round"
            strokeWidth="1.1"
          />
        );
      })}
    </g>
  );
}
