"use client";

import { ArrowUpRight, Boxes, Layers3, Info, Sun, Wind } from "lucide-react";
import { useState } from "react";
import { EnvironmentOverlay } from "@/components/site/EnvironmentOverlay";
import { SimpleTooltip } from "@/components/ui/Tooltip";
import type { PlanVersion, Room } from "@/lib/project-types";
import { useSiteState } from "@/lib/project-store";
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
  const [overlayMode, setOverlayMode] = useState<"sun" | "wind" | "both" | "none">("both");
  const {
    siteContext,
    buildableEnvelope,
    environmentSurrogate,
    showSiteContextLayer,
    showEnvironmentOverlay
  } = useSiteState((state) => ({
    siteContext: state.siteContext,
    buildableEnvelope: state.buildableEnvelope,
    environmentSurrogate: state.environmentSurrogate,
    showSiteContextLayer: state.showSiteContextLayer,
    showEnvironmentOverlay: state.showEnvironmentOverlay
  }));

  if (!activeVersion) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div>
          <Boxes className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-3 text-sm text-muted">选择或生成方案版本以创建体块研究</p>
        </div>
      </div>
    );
  }

  const quantities = calculateQuantities(activeVersion);
  const padding = 10;
  const minX = -padding;
  const minY = -padding - 12;
  const viewBox = `${minX} ${minY} ${activeVersion.overallBounds.width + padding * 2 + 20} ${
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
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-white">体块研究</h1>
            <SimpleTooltip title="基于平面房间生成的2.5D建筑体块模型">
              <Info className="h-3.5 w-3.5 text-muted" />
            </SimpleTooltip>
          </div>
          <Boxes className="h-4 w-4 text-accent" />
        </div>

        <div className="space-y-3">
          <SimpleTooltip title="建筑平面的总尺寸范围" side="right">
            <div>
              <Metric label="边界尺寸" value={`${activeVersion.overallBounds.width} x ${activeVersion.overallBounds.height} m`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="所有房间的总建筑面积" side="right">
            <div>
              <Metric label="总建筑面积" value={`${quantities.summary.grossArea} m²`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="服务性空间（设备房、储藏等）占总面积的比例" side="right">
            <div>
              <Metric label="服务空间比" value={`${Math.round((serviceArea / total) * 100)}%`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="公共和半公共空间占总面积的比例" side="right">
            <div>
              <Metric label="公共空间比" value={`${Math.round((publicArea / total) * 100)}%`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="交通流线空间（走廊、楼梯等）占总面积的比例" side="right">
            <div>
              <Metric label="交通空间比" value={`${Math.round((circulationArea / total) * 100)}%`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="可建范围的总体积" side="right">
            <div>
              <Metric
                label="可建体积"
                value={buildableEnvelope?.valid ? `${buildableEnvelope.volumeCubicMeters} m³` : "未定义"}
              />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="场地周边的建筑物数量" side="right">
            <div>
              <Metric label="周边建筑" value={String(siteContext?.buildings.length ?? 0)} />
            </div>
          </SimpleTooltip>
        </div>

        <SimpleTooltip title="在独立窗口中打开完整的3D建筑模型查看器">
          <button
            className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014] hover:bg-accent/90 transition-colors"
            type="button"
            onClick={onOpenModel}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            打开完整3D模型
          </button>
        </SimpleTooltip>
      </aside>

      <section className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">2.5D 体块画布</h2>
            <p className="mt-1 text-xs text-muted">
              实时阳光和风力模拟叠加层，以及规划可建范围
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded border border-line p-0.5">
              <SimpleTooltip title="显示阳光模拟">
                <button
                  className={`rounded p-1.5 transition-colors ${
                    overlayMode === "sun" || overlayMode === "both"
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-panel/50 hover:text-slate-200"
                  }`}
                  type="button"
                  onClick={() => setOverlayMode(overlayMode === "sun" ? "none" : overlayMode === "both" ? "wind" : overlayMode === "wind" ? "both" : "sun")}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
              </SimpleTooltip>
              <SimpleTooltip title="显示风力模拟">
                <button
                  className={`rounded p-1.5 transition-colors ${
                    overlayMode === "wind" || overlayMode === "both"
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-panel/50 hover:text-slate-200"
                  }`}
                  type="button"
                  onClick={() => setOverlayMode(overlayMode === "wind" ? "none" : overlayMode === "both" ? "sun" : overlayMode === "sun" ? "both" : "wind")}
                >
                  <Wind className="h-3.5 w-3.5" />
                </button>
              </SimpleTooltip>
            </div>
            <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">{activeVersion.label}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
          <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
          <svg
            className="relative h-full min-h-[560px] w-full"
            viewBox={viewBox}
            role="img"
            aria-label={`建筑体量图，包含${activeVersion.rooms.length}个空间，总面积${quantities.summary.grossArea}平方米`}
          >
            {showEnvironmentOverlay && (overlayMode === "sun" || overlayMode === "both") ? (
              <EnvironmentOverlay
                surrogate={environmentSurrogate}
                width={activeVersion.overallBounds.width}
                height={activeVersion.overallBounds.height}
                minX={0}
                minY={0}
                mode="sun"
              />
            ) : null}
            {showEnvironmentOverlay && (overlayMode === "wind" || overlayMode === "both") ? (
              <EnvironmentOverlay
                surrogate={environmentSurrogate}
                width={activeVersion.overallBounds.width}
                height={activeVersion.overallBounds.height}
                minX={0}
                minY={0}
                mode="wind"
              />
            ) : null}
                  minX={0}
                  minY={0}
                  mode="wind"
                />
              </>
            ) : null}

            {showSiteContextLayer && siteContext
              ? siteContext.roads.map((road) => (
                  <polyline
                    key={road.id}
                    points={road.points.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="none"
                    stroke="rgba(148,163,184,0.45)"
                    strokeWidth="0.5"
                  />
                ))
              : null}

            {showSiteContextLayer && siteContext
              ? siteContext.buildings.map((building) => (
                  <polygon
                    key={building.id}
                    points={building.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="rgba(100,116,139,0.16)"
                    stroke="rgba(148,163,184,0.5)"
                    strokeWidth="0.25"
                  />
                ))
              : null}

            {buildableEnvelope?.valid ? (
              <polygon
                points={buildableEnvelope.footprint.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="rgba(79,181,200,0.08)"
                stroke="#4fb5c8"
                strokeDasharray="1.2 0.8"
                strokeWidth="0.35"
              />
            ) : null}

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
