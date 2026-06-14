"use client";

import { ArrowUpRight, Boxes, Layers3 } from "lucide-react";
import type { PlanVersion, Room } from "@/lib/project-types";
import { calculateQuantities } from "@/lib/quantity-engine";

interface MassingPanelProps {
  activeVersion?: PlanVersion;
  onOpenModel: () => void;
}

const zoneColors: Record<Room["zone"], { top: string; side: string; stroke: string }> = {
  public: { top: "rgba(79,181,200,0.42)", side: "rgba(79,181,200,0.2)", stroke: "#4fb5c8" },
  semi_public: { top: "rgba(132,204,22,0.34)", side: "rgba(132,204,22,0.18)", stroke: "#84cc16" },
  private: { top: "rgba(167,139,250,0.34)", side: "rgba(167,139,250,0.18)", stroke: "#a78bfa" },
  service: { top: "rgba(230,162,60,0.4)", side: "rgba(230,162,60,0.2)", stroke: "#e6a23c" },
  circulation: { top: "rgba(148,163,184,0.32)", side: "rgba(148,163,184,0.16)", stroke: "#94a3b8" }
};

function roomBounds(room: Room) {
  return room.polygon.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function massHeight(room: Room) {
  const specialBoost = room.type === "shaft" || room.type === "elevator" || room.type === "stair" ? 2.2 : 0;
  const equipmentBoost = room.type === "equipment_room" ? 1.2 : 0;
  return room.ceilingHeight + specialBoost + equipmentBoost;
}

function prismPath(x: number, y: number, width: number, height: number, lift: number) {
  const dx = lift * 0.7;
  const dy = -lift;
  const top = `${x + dx},${y + dy} ${x + width + dx},${y + dy} ${x + width + dx},${y + height + dy} ${x + dx},${y + height + dy}`;
  const front = `${x},${y} ${x + width},${y} ${x + width + dx},${y + dy} ${x + dx},${y + dy}`;
  const side = `${x + width},${y} ${x + width},${y + height} ${x + width + dx},${y + height + dy} ${x + width + dx},${y + dy}`;
  return { top, front, side };
}

export function MassingPanel({ activeVersion, onOpenModel }: MassingPanelProps) {
  if (!activeVersion) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to create massing.
      </div>
    );
  }

  const quantities = calculateQuantities(activeVersion);
  const padding = 10;
  const viewBox = `${-padding} ${-padding - 12} ${activeVersion.overallBounds.width + padding * 2 + 20} ${
    activeVersion.overallBounds.height + padding * 2 + 20
  }`;
  const serviceArea = quantities.areaByZone.service;
  const publicArea = quantities.areaByZone.public + quantities.areaByZone.semi_public;
  const circulationArea = quantities.areaByZone.circulation;
  const total = Math.max(1, quantities.summary.grossArea);

  return (
    <section className="grid min-h-full grid-cols-[320px_minmax(0,1fr)] gap-4">
      <aside className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Massing Study</h1>
            <p className="mt-1 text-xs text-muted">2.5D massing generated from activeVersion rooms.</p>
          </div>
          <Boxes className="h-4 w-4 text-accent" />
        </div>

        <div className="space-y-3">
          <Metric label="Bounds" value={`${activeVersion.overallBounds.width} x ${activeVersion.overallBounds.height} m`} />
          <Metric label="Gross area" value={`${quantities.summary.grossArea} sqm`} />
          <Metric label="Service ratio" value={`${Math.round((serviceArea / total) * 100)}%`} />
          <Metric label="Public ratio" value={`${Math.round((publicArea / total) * 100)}%`} />
          <Metric label="Circulation ratio" value={`${Math.round((circulationArea / total) * 100)}%`} />
          <Metric label="Core / shaft rooms" value={String(activeVersion.rooms.filter((room) => ["stair", "elevator", "shaft"].includes(room.type)).length)} />
        </div>

        <button
          className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014]"
          type="button"
          onClick={onOpenModel}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          Open Full 3D Model
        </button>
      </aside>

      <section className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">2.5D Massing Canvas</h2>
            <p className="mt-1 text-xs text-muted">Simplified volume blocks. Height is derived from room type and ceiling height.</p>
          </div>
          <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">{activeVersion.label}</span>
        </div>

        <div className="relative overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
          <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
          <svg className="relative h-full min-h-[560px] w-full" viewBox={viewBox} role="img">
            <polygon
              points={activeVersion.outline.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="rgba(255,255,255,0.018)"
              stroke="#d8edf5"
              strokeWidth="0.35"
            />
            {[...activeVersion.rooms]
              .sort((a, b) => roomBounds(a).minY - roomBounds(b).minY)
              .map((room) => {
                const bounds = roomBounds(room);
                const lift = massHeight(room) * 1.2;
                const prism = prismPath(
                  bounds.minX,
                  bounds.minY,
                  bounds.maxX - bounds.minX,
                  bounds.maxY - bounds.minY,
                  lift
                );
                const colors = zoneColors[room.zone];
                const labelX = (bounds.minX + bounds.maxX) / 2 + lift * 0.35;
                const labelY = (bounds.minY + bounds.maxY) / 2 - lift;

                return (
                  <g key={room.id}>
                    <polygon points={prism.front} fill={colors.side} stroke={colors.stroke} strokeWidth="0.18" />
                    <polygon points={prism.side} fill={colors.side} stroke={colors.stroke} strokeWidth="0.18" />
                    <polygon points={prism.top} fill={colors.top} stroke={colors.stroke} strokeWidth="0.28" />
                    <text fill="#e5edf5" fontSize="1.35" textAnchor="middle" x={labelX} y={labelY}>
                      {room.name}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Layers3 className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <div className="text-sm text-slate-100">{value}</div>
    </div>
  );
}
