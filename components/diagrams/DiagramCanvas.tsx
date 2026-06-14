"use client";

import type { AnalysisLayerId, PlanVersion, Point, Room } from "@/lib/project-types";
import { ANALYSIS_LAYERS } from "@/components/diagrams/DiagramLayerList";

interface DiagramCanvasProps {
  activeLayers: AnalysisLayerId[];
  version?: PlanVersion;
}

const zoneColors: Record<Room["zone"], string> = {
  public: "rgba(79, 181, 200, 0.32)",
  semi_public: "rgba(132, 204, 22, 0.26)",
  private: "rgba(167, 139, 250, 0.26)",
  service: "rgba(230, 162, 60, 0.3)",
  circulation: "rgba(148, 163, 184, 0.24)"
};

const zoneStrokes: Record<Room["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

const layerLegend: Partial<Record<AnalysisLayerId, { color: string; label: string }>> = {
  function_zones: { color: "#4fb5c8", label: "Zone fill by function" },
  patient_flow: { color: "#38bdf8", label: "Patient route" },
  staff_flow: { color: "#a78bfa", label: "Staff route" },
  clean_dirty_flow: { color: "#f59e0b", label: "Clean / dirty separation" },
  daylight: { color: "#facc15", label: "Daylight exposure" },
  ventilation: { color: "#5eead4", label: "Ventilation vector" },
  sightline: { color: "#fb7185", label: "Sightline cone" },
  egress_path: { color: "#22c55e", label: "Egress path" },
  egress_distance: { color: "#f97316", label: "Egress distance band" },
  core_efficiency: { color: "#c084fc", label: "Core distance" }
};

function polygonPoints(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function roomByType(version: PlanVersion, types: Room["type"][]) {
  return version.rooms.find((room) => types.includes(room.type));
}

function routePath(rooms: Room[]) {
  return rooms.map((room) => centroid(room)).map(([x, y]) => `${x},${y}`).join(" ");
}

function nearestCorePoint(version: PlanVersion): Point {
  const core = roomByType(version, ["stair", "elevator", "shaft"]);
  return core ? centroid(core) : [version.overallBounds.width / 2, version.overallBounds.height / 2];
}

function hasWindowOpening(version: PlanVersion, room: Room) {
  const openings = version.levels[0]?.openings ?? [];

  if (openings.length === 0) {
    return room.windows.length > 0;
  }

  return openings.some((opening) => opening.type === "window" && opening.roomIds?.includes(room.id));
}

export function DiagramCanvas({ activeLayers, version }: DiagramCanvasProps) {
  if (!version) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to show analysis overlays.
      </div>
    );
  }

  const padding = 8;
  const viewBox = `${-padding} ${-padding} ${version.overallBounds.width + padding * 2} ${
    version.overallBounds.height + padding * 2
  }`;
  const publicRoom = roomByType(version, ["lobby"]) ?? version.rooms[0];
  const corridor = roomByType(version, ["corridor"]);
  const consultation = roomByType(version, ["consultation"]);
  const office = roomByType(version, ["office"]);
  const service = roomByType(version, ["equipment_room", "shaft"]);
  const corePoint = nearestCorePoint(version);

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Analysis Canvas</h1>
          <p className="mt-1 text-xs text-muted">Rule-based overlays generated from semantic room data.</p>
        </div>
        <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">
          {version.label}
        </span>
      </div>

      <div className="relative overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg className="relative h-full min-h-[560px] w-full" viewBox={viewBox} role="img">
          <defs>
            <marker id="arrow-patient" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-staff" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#a78bfa" />
            </marker>
            <marker id="arrow-egress" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#22c55e" />
            </marker>
          </defs>

          <polygon points={polygonPoints(version.outline)} fill="rgba(255,255,255,0.018)" stroke="#d8edf5" strokeWidth="0.35" />

          {version.rooms.map((room) => (
            <polygon
              fill={activeLayers.includes("function_zones") ? zoneColors[room.zone] : "rgba(148,163,184,0.08)"}
              key={room.id}
              points={polygonPoints(room.polygon)}
              stroke={activeLayers.includes("function_zones") ? zoneStrokes[room.zone] : "rgba(216,237,245,0.4)"}
              strokeWidth="0.25"
            />
          ))}

          {activeLayers.includes("daylight")
            ? version.rooms
                .filter((room) => room.needsDaylight || hasWindowOpening(version, room))
                .map((room) => {
                  const [x, y] = centroid(room);
                  return (
                    <g key={`daylight-${room.id}`}>
                      <circle cx={x} cy={y} fill="rgba(250,204,21,0.18)" r={Math.max(3, Math.sqrt(room.areaSqm) / 2.8)} />
                      <text fill="#facc15" fontSize="1.3" textAnchor="middle" x={x} y={y + 0.45}>
                        DL
                      </text>
                    </g>
                  );
                })
            : null}

          {activeLayers.includes("patient_flow") && publicRoom && consultation ? (
            <polyline
              fill="none"
              markerEnd="url(#arrow-patient)"
              points={routePath([publicRoom, ...(corridor ? [corridor] : []), consultation])}
              stroke="#38bdf8"
              strokeDasharray="2 1.4"
              strokeWidth="0.7"
            />
          ) : null}

          {activeLayers.includes("staff_flow") && office ? (
            <polyline
              fill="none"
              markerEnd="url(#arrow-staff)"
              points={routePath([office, ...(corridor ? [corridor] : []), consultation ?? office])}
              stroke="#a78bfa"
              strokeWidth="0.65"
            />
          ) : null}

          {activeLayers.includes("clean_dirty_flow") && service && corridor ? (
            <g>
              <polyline fill="none" points={routePath([service, corridor])} stroke="#f59e0b" strokeDasharray="1 1" strokeWidth="0.65" />
              <polyline fill="none" points={routePath([publicRoom, corridor])} stroke="#5eead4" strokeDasharray="2 1" strokeWidth="0.5" />
            </g>
          ) : null}

          {activeLayers.includes("ventilation")
            ? version.rooms
                .filter((room) => hasWindowOpening(version, room))
                .map((room) => {
                  const [x, y] = centroid(room);
                  return (
                    <line key={`vent-${room.id}`} stroke="#5eead4" strokeWidth="0.45" x1={x - 3} x2={x + 3} y1={y} y2={y - 2} />
                  );
                })
            : null}

          {activeLayers.includes("sightline") && publicRoom && corridor ? (
            <polygon
              fill="rgba(251,113,133,0.12)"
              points={`${centroid(publicRoom)[0]},${centroid(publicRoom)[1]} ${centroid(corridor)[0] - 6},${centroid(corridor)[1] - 10} ${centroid(corridor)[0] + 6},${centroid(corridor)[1] + 10}`}
              stroke="#fb7185"
              strokeDasharray="1.5 1"
              strokeWidth="0.35"
            />
          ) : null}

          {activeLayers.includes("egress_path")
            ? version.rooms
                .filter((room) => room.type !== "stair" && room.type !== "elevator" && room.type !== "shaft")
                .map((room) => {
                  const [x, y] = centroid(room);
                  return (
                    <line
                      key={`egress-${room.id}`}
                      markerEnd="url(#arrow-egress)"
                      stroke="#22c55e"
                      strokeOpacity="0.75"
                      strokeWidth="0.35"
                      x1={x}
                      x2={corePoint[0]}
                      y1={y}
                      y2={corePoint[1]}
                    />
                  );
                })
            : null}

          {activeLayers.includes("egress_distance")
            ? version.rooms.map((room) => {
                const [x, y] = centroid(room);
                const distance = Math.hypot(x - corePoint[0], y - corePoint[1]);
                return (
                  <text
                    fill={distance > 30 ? "#f97316" : "#9fb3c8"}
                    fontSize="1.3"
                    key={`distance-${room.id}`}
                    textAnchor="middle"
                    x={x}
                    y={y + 2.2}
                  >
                    {Math.round(distance)}m
                  </text>
                );
              })
            : null}

          {activeLayers.includes("core_efficiency") ? (
            <g>
              <circle cx={corePoint[0]} cy={corePoint[1]} fill="rgba(192,132,252,0.2)" r="5" stroke="#c084fc" strokeWidth="0.45" />
              {version.rooms.map((room) => {
                const [x, y] = centroid(room);
                return <line key={`core-${room.id}`} stroke="#c084fc" strokeOpacity="0.28" strokeWidth="0.25" x1={corePoint[0]} x2={x} y1={corePoint[1]} y2={y} />;
              })}
            </g>
          ) : null}

          {version.rooms.map((room) => {
            const [x, y] = centroid(room);
            return (
              <text fill="#e5edf5" fontSize="1.45" key={`label-${room.id}`} textAnchor="middle" x={x} y={y - 0.6} style={{ paintOrder: "stroke", stroke: "#081018", strokeWidth: 0.25 }}>
                {room.name}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeLayers.map((layerId) => {
          const layer = ANALYSIS_LAYERS.find((item) => item.id === layerId);
          const legend = layerLegend[layerId];
          return (
            <div className="flex items-center gap-2 rounded border border-line bg-[#0b1118] px-2 py-1 text-xs text-muted" key={layerId}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: legend?.color ?? "#9fb3c8" }} />
              <span>{layer?.label ?? layerId}</span>
              {legend ? <span className="text-[11px] text-muted/80">/ {legend.label}</span> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
