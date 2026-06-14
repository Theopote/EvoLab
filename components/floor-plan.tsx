"use client";

import type { PlanVersion, Room } from "@/lib/project-types";

const zoneColors: Record<Room["zone"], string> = {
  public: "rgba(79, 181, 200, 0.24)",
  semi_public: "rgba(132, 204, 22, 0.2)",
  private: "rgba(167, 139, 250, 0.2)",
  service: "rgba(230, 162, 60, 0.2)",
  circulation: "rgba(148, 163, 184, 0.18)"
};

const zoneStrokes: Record<Room["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

interface FloorPlanProps {
  version?: PlanVersion;
  className?: string;
}

function getCentroid(room: Room) {
  const total = room.polygon.reduce(
    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / room.polygon.length,
    y: total.y / room.polygon.length
  };
}

export function FloorPlan({ version, className }: FloorPlanProps) {
  if (!version) {
    return (
      <div className={className}>
        <div className="grid h-full min-h-[420px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
          Draw an outline and generate plan options.
        </div>
      </div>
    );
  }

  const padding = 8;
  const viewBox = `${-padding} ${-padding} ${version.overallBounds.width + padding * 2} ${
    version.overallBounds.height + padding * 2
  }`;
  const level = version.levels[0];

  return (
    <div className={className}>
      <div className="relative min-h-[420px] overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg className="relative h-full min-h-[420px] w-full" viewBox={viewBox} role="img">
          <polygon
            points={version.outline.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="rgba(255,255,255,0.018)"
            stroke="#d8edf5"
            strokeWidth="0.35"
          />
          {version.rooms.map((room) => {
            const centroid = getCentroid(room);
            return (
              <g key={room.id}>
                <polygon
                  points={room.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill={zoneColors[room.zone]}
                  stroke={zoneStrokes[room.zone]}
                  strokeWidth="0.25"
                />
                <text
                  x={centroid.x}
                  y={centroid.y - 0.9}
                  fill="#e5edf5"
                  fontSize="1.7"
                  textAnchor="middle"
                  style={{ paintOrder: "stroke", stroke: "#081018", strokeWidth: 0.25 }}
                >
                  {room.name}
                </text>
                <text x={centroid.x} y={centroid.y + 1.3} fill="#9fb3c8" fontSize="1.35" textAnchor="middle">
                  {room.areaSqm} sqm
                </text>
              </g>
            );
          })}
          {level?.walls.map((wall) => (
            <line
              key={wall.id}
              x1={wall.start[0]}
              y1={wall.start[1]}
              x2={wall.end[0]}
              y2={wall.end[1]}
              stroke={wall.type === "external" ? "#e5f6ff" : wall.type === "core" ? "#f0b35b" : "#7d8fa3"}
              strokeLinecap="round"
              strokeWidth={wall.thickness}
            />
          ))}
          {level?.openings.map((opening) => (
            <g key={opening.id}>
              <circle
                cx={opening.center[0]}
                cy={opening.center[1]}
                r={opening.type === "door" ? 0.45 : 0.35}
                fill={opening.type === "door" ? "#4fb5c8" : "#84cc16"}
                stroke="#081018"
                strokeWidth="0.16"
              />
              <text
                x={opening.center[0]}
                y={opening.center[1] - 0.75}
                fill="#c9d7e3"
                fontSize="1"
                textAnchor="middle"
              >
                {opening.type === "door" ? "D" : opening.type === "window" ? "W" : "O"}
              </text>
            </g>
          ))}
        </svg>
        <div className="absolute bottom-3 left-3 rounded border border-line bg-[#081018]/90 px-2 py-1 text-xs text-muted">
          1 grid = 1 m / {version.label}
        </div>
      </div>
    </div>
  );
}
