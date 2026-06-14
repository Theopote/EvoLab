"use client";

import { MEP_LAYERS, type MepLayerId } from "@/components/mep/MepLayerList";
import type { MepLayout, MepRoute, MepSystemType, PlanVersion, Point, Room } from "@/lib/project-types";

interface MepCanvasProps {
  activeLayers: MepLayerId[];
  version?: PlanVersion;
}

const systemColors: Record<MepSystemType, string> = {
  hvac: "#5eead4",
  plumbing_supply: "#38bdf8",
  plumbing_drain: "#60a5fa",
  electrical: "#facc15",
  elv: "#a78bfa",
  fire: "#fb7185"
};

function polygonPoints(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function createRuleBasedMep(version: PlanVersion): MepLayout {
  const shaftRooms = version.rooms.filter((room) => room.type === "shaft");
  const equipmentRooms = version.rooms.filter((room) => room.type === "equipment_room");
  const corridor = version.rooms.find((room) => room.type === "corridor");
  const wetRooms = version.rooms.filter((room) => room.needsPlumbing);
  const primaryShaft: Point =
    shaftRooms[0] ? centroid(shaftRooms[0]) : equipmentRooms[0] ? centroid(equipmentRooms[0]) : [version.overallBounds.width * 0.7, version.overallBounds.height * 0.55];
  const trunkStart: Point = corridor ? centroid(corridor) : [version.overallBounds.width * 0.35, version.overallBounds.height * 0.5];
  const systems: MepSystemType[] = ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "elv", "fire"];

  return {
    shafts: [
      {
        id: "rule-shaft-01",
        position: primaryShaft,
        systems
      }
    ],
    routes: systems.map((system, index) => {
      const targetRooms =
        system === "plumbing_supply" || system === "plumbing_drain"
          ? wetRooms
          : system === "hvac"
            ? [...equipmentRooms, ...version.rooms.filter((room) => room.zone !== "service")]
            : version.rooms;
      const path: Point[] = [
        [trunkStart[0], trunkStart[1] + index * 0.9],
        [primaryShaft[0], trunkStart[1] + index * 0.9],
        primaryShaft
      ];

      return {
        id: `rule-route-${system}`,
        system,
        path,
        connectsRoomIds: targetRooms.map((room) => room.id)
      };
    })
  };
}

function routePoints(route: MepRoute) {
  return route.path.map(([x, y]) => `${x},${y}`).join(" ");
}

export function MepCanvas({ activeLayers, version }: MepCanvasProps) {
  if (!version) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to show MEP systems.
      </div>
    );
  }

  const mep = version.mep ?? createRuleBasedMep(version);
  const padding = 8;
  const viewBox = `${-padding} ${-padding} ${version.overallBounds.width + padding * 2} ${
    version.overallBounds.height + padding * 2
  }`;
  const equipmentRooms = version.rooms.filter((room) => room.type === "equipment_room");
  const shaftRooms = version.rooms.filter((room) => room.type === "shaft");

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Concept MEP Diagram</h1>
          <p className="mt-1 text-xs text-muted">
            {version.mep ? "Generated MEP layout stored on activeVersion.mep." : "Rule-based preview until Generate MEP is run."}
          </p>
        </div>
        <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">{version.label}</span>
      </div>

      <div className="relative overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg className="relative h-full min-h-[560px] w-full" viewBox={viewBox} role="img">
          <defs>
            {Object.entries(systemColors).map(([system, color]) => (
              <marker id={`mep-arrow-${system}`} key={system} markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
                <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
              </marker>
            ))}
          </defs>

          <polygon points={polygonPoints(version.outline)} fill="rgba(255,255,255,0.018)" stroke="#d8edf5" strokeWidth="0.35" />

          {version.rooms.map((room) => (
            <polygon
              fill={room.zone === "service" ? "rgba(230,162,60,0.12)" : "rgba(148,163,184,0.07)"}
              key={room.id}
              points={polygonPoints(room.polygon)}
              stroke={room.zone === "service" ? "rgba(230,162,60,0.7)" : "rgba(216,237,245,0.36)"}
              strokeWidth="0.25"
            />
          ))}

          {activeLayers.includes("equipment_rooms")
            ? equipmentRooms.map((room) => {
                const [x, y] = centroid(room);
                return (
                  <g key={`equipment-${room.id}`}>
                    <polygon points={polygonPoints(room.polygon)} fill="rgba(230,162,60,0.28)" stroke="#e6a23c" strokeWidth="0.45" />
                    <text fill="#e6a23c" fontSize="1.35" textAnchor="middle" x={x} y={y}>
                      EQUIP
                    </text>
                  </g>
                );
              })
            : null}

          {activeLayers.includes("shafts")
            ? [
                ...shaftRooms.map((room) => ({ id: room.id, position: centroid(room) })),
                ...mep.shafts
              ].map((shaft) => (
                <g key={`shaft-${shaft.id}`}>
                  <rect
                    fill="rgba(249,115,22,0.28)"
                    height="3.4"
                    stroke="#f97316"
                    strokeWidth="0.45"
                    width="3.4"
                    x={shaft.position[0] - 1.7}
                    y={shaft.position[1] - 1.7}
                  />
                  <text fill="#f97316" fontSize="1.15" textAnchor="middle" x={shaft.position[0]} y={shaft.position[1] + 0.35}>
                    SHAFT
                  </text>
                </g>
              ))
            : null}

          {mep.routes
            .filter((route) => activeLayers.includes(route.system))
            .map((route, index) => (
              <g key={route.id}>
                <polyline
                  fill="none"
                  markerEnd={`url(#mep-arrow-${route.system})`}
                  points={routePoints(route)}
                  stroke={systemColors[route.system]}
                  strokeDasharray={route.system === "plumbing_drain" || route.system === "elv" ? "1.3 1" : undefined}
                  strokeWidth={0.58 + index * 0.015}
                />
                {route.path.map(([x, y], pointIndex) => (
                  <circle cx={x} cy={y} fill={systemColors[route.system]} key={`${route.id}-${pointIndex}`} r="0.65" />
                ))}
              </g>
            ))}

          {version.rooms.map((room) => {
            const [x, y] = centroid(room);
            return (
              <text
                fill="#dbe7ef"
                fontSize="1.35"
                key={`label-${room.id}`}
                textAnchor="middle"
                x={x}
                y={y - 0.55}
                style={{ paintOrder: "stroke", stroke: "#081018", strokeWidth: 0.25 }}
              >
                {room.name}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeLayers.map((layerId) => {
          const layer = MEP_LAYERS.find((item) => item.id === layerId);
          return (
            <div className="flex items-center gap-2 rounded border border-line bg-[#0b1118] px-2 py-1 text-xs text-muted" key={layerId}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: layer?.color ?? "#9fb3c8" }} />
              <span>{layer?.label ?? layerId}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
