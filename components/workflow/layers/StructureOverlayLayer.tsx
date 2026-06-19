"use client";

import type { StructuralSystem } from "@/lib/building-domain";

interface StructureOverlayLayerProps {
  structuralSystem?: StructuralSystem;
  levelId?: string;
}

export function StructureOverlayLayer({ structuralSystem, levelId }: StructureOverlayLayerProps) {
  if (!structuralSystem) {
    return null;
  }

  const columns = structuralSystem.columns.filter((column) => !levelId || column.levelId === levelId);
  const beams = structuralSystem.beams.filter((beam) => !levelId || beam.levelId === levelId);
  const shearWalls = structuralSystem.shearWalls.filter((wall) => !levelId || wall.levelId === levelId);

  return (
    <g data-layer="structure-overlay">
      {beams.map((beam) => (
        <line
          key={beam.id}
          x1={beam.start[0]}
          y1={beam.start[1]}
          x2={beam.end[0]}
          y2={beam.end[1]}
          stroke="rgba(251, 146, 60, 0.75)"
          strokeWidth="0.22"
        />
      ))}
      {shearWalls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.start[0]}
          y1={wall.start[1]}
          x2={wall.end[0]}
          y2={wall.end[1]}
          stroke="rgba(248, 113, 113, 0.85)"
          strokeWidth={wall.thickness}
        />
      ))}
      {columns.map((column) => (
        <rect
          key={column.id}
          x={column.position[0] - column.width / 2}
          y={column.position[1] - column.depth / 2}
          width={column.width}
          height={column.depth}
          fill="rgba(56, 189, 248, 0.35)"
          stroke="#38bdf8"
          strokeWidth="0.12"
        />
      ))}
    </g>
  );
}
