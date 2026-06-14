import type { PlanVersion } from "@/lib/project-types";
import { getCentroid } from "@/components/floor-plan/floor-plan-utils";

interface LabelLayerProps {
  version: PlanVersion;
}

export function LabelLayer({ version }: LabelLayerProps) {
  return (
    <g data-layer="labels">
      {version.rooms.map((room) => {
        const [x, y] = getCentroid(room);

        return (
          <g key={room.id}>
            <text
              x={x}
              y={y - 0.9}
              fill="#e5edf5"
              fontSize="1.55"
              textAnchor="middle"
              style={{ paintOrder: "stroke", stroke: "#081018", strokeWidth: 0.25 }}
            >
              {room.name}
            </text>
            <text x={x} y={y + 1.15} fill="#9fb3c8" fontSize="1.2" textAnchor="middle">
              {room.areaSqm} sqm
            </text>
          </g>
        );
      })}
      <text x={1} y={version.overallBounds.height + 4.2} fill="#64748b" fontSize="1.15">
        Wall / opening / core symbols generated from Level model
      </text>
    </g>
  );
}
