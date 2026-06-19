"use client";

import type { FurnitureItem, FurnitureLayout } from "@/lib/building-domain";

const categoryTone: Record<FurnitureItem["category"], string> = {
  desk: "#38bdf8",
  chair: "#94a3b8",
  bed: "#a78bfa",
  table: "#34d399",
  sofa: "#fbbf24",
  equipment: "#fb923c"
};

interface FurnitureOverlayLayerProps {
  layout?: FurnitureLayout;
  levelId?: string;
}

export function FurnitureOverlayLayer({ layout, levelId }: FurnitureOverlayLayerProps) {
  if (!layout) {
    return null;
  }

  const items = layout.items.filter((item) => !levelId || item.levelId === levelId);

  return (
    <g data-layer="furniture-overlay">
      {items.map((item) => (
        <g key={item.id} transform={`rotate(${item.rotationDeg} ${item.position[0]} ${item.position[1]})`}>
          <rect
            x={item.position[0] - item.width / 2}
            y={item.position[1] - item.depth / 2}
            width={item.width}
            height={item.depth}
            fill={`${categoryTone[item.category]}33`}
            stroke={categoryTone[item.category]}
            strokeWidth="0.1"
            rx="0.08"
          />
          <text
            fill="#e2e8f0"
            fontSize="0.9"
            textAnchor="middle"
            x={item.position[0]}
            y={item.position[1] + 0.35}
          >
            {item.name}
          </text>
        </g>
      ))}
    </g>
  );
}
