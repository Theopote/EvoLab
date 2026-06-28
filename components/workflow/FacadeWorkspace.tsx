"use client";

import { Sun, Info } from "lucide-react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { FacadeOverlayLayer } from "@/components/workflow/layers/FacadeOverlayLayer";
import { SimpleTooltip } from "@/components/ui/Tooltip";
import type { FacadeEnvelope } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

interface FacadeWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  facadeEnvelope?: FacadeEnvelope;
  orientationDeg?: number;
  onLevelChange: (levelId: string) => void;
  onUpdateFacadeEnvelope?: (patch: Partial<Pick<FacadeEnvelope, "defaultWindowRatio" | "orientationStrategy">>) => void;
  onUpdateFacadeZone?: (
    zoneId: string,
    patch: Partial<Pick<FacadeEnvelope["zones"][number], "strategy" | "targetWindowRatio">>
  ) => void;
}

const strategyOptions: Array<{ value: FacadeEnvelope["zones"][number]["strategy"]; label: string }> = [
  { value: "curtain_wall", label: "玻璃幕墙" },
  { value: "punched_window", label: "打孔窗" },
  { value: "solid", label: "实体墙" },
  { value: "mixed", label: "混合" }
];

export function FacadeWorkspace({
  version,
  activeLevelId,
  facadeEnvelope,
  orientationDeg,
  onLevelChange,
  onUpdateFacadeEnvelope,
  onUpdateFacadeZone
}: FacadeWorkspaceProps) {
  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div>
          <Sun className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-3 text-sm text-muted">生成或选择方案版本以查看立面分区和窗墙比</p>
        </div>
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const zones = facadeEnvelope?.zones.filter((zone) => !activeLevel || zone.levelId === activeLevel.id) ?? [];

  return (
    <section className="grid min-h-full grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)] gap-4">
      <div className="space-y-4 overflow-auto">
        <header className="rounded border border-line bg-panel/90 p-3">
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-base font-semibold text-white">
              <Sun className="h-4 w-4 text-accent" />
              立面包络
            </h1>
            <SimpleTooltip title="配置建筑立面的玻璃窗比例和外墙策略">
              <Info className="h-3.5 w-3.5 text-muted" />
            </SimpleTooltip>
          </div>
          <p className="mt-1 text-xs text-muted">
            编辑窗墙比目标和周边策略，修改后会在模型域中持久化
          </p>
          <div className="mt-3 space-y-3">
            <label className="block">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-1.5">
                <span>朝向策略</span>
                <SimpleTooltip title="定义建筑主要朝向的偏好，如balanced（平衡）、south_facing（朝南）等">
                  <Info className="h-3 w-3 text-muted" />
                </SimpleTooltip>
              </div>
              <input
                className="h-9 w-full rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100 hover:border-accent/50 focus:border-accent outline-none transition-colors"
                placeholder="例如：balanced, south_facing"
                value={facadeEnvelope?.orientationStrategy ?? "balanced"}
                onChange={(event) => onUpdateFacadeEnvelope?.({ orientationStrategy: event.target.value })}
              />
            </label>
            <label className="block">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-1.5">
                <span>默认窗墙比</span>
                <SimpleTooltip title="窗户面积占墙体面积的比例，0.0-1.0之间（0%-100%）">
                  <Info className="h-3 w-3 text-muted" />
                </SimpleTooltip>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 h-9 rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100 hover:border-accent/50 focus:border-accent outline-none transition-colors"
                  max={1}
                  min={0}
                  step={0.05}
                  type="number"
                  value={facadeEnvelope?.defaultWindowRatio ?? 0.35}
                  onChange={(event) => {
                    const value = Math.max(0, Math.min(1, Number(event.target.value)));
                    onUpdateFacadeEnvelope?.({ defaultWindowRatio: value });
                  }}
                />
                <span className="text-xs text-muted w-12 text-right">
                  {Math.round((facadeEnvelope?.defaultWindowRatio ?? 0.35) * 100)}%
                </span>
              </div>
            </label>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <SimpleTooltip title="建筑优选朝向角度" side="bottom">
              <div>
                <Metric label="优选朝向" value={`${orientationDeg ?? 180}°`} />
              </div>
            </SimpleTooltip>
            <SimpleTooltip title="立面分区总数" side="bottom">
              <div>
                <Metric label="分区数量" value={String(facadeEnvelope?.zones.length ?? 0)} />
              </div>
            </SimpleTooltip>
          </dl>
        </header>

        {version.levels.length > 1 ? (
          <SimpleTooltip title="选择要编辑立面的楼层">
            <select
              className="h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100 hover:border-accent/50 transition-colors"
              value={activeLevel?.id}
              onChange={(event) => onLevelChange(event.target.value)}
            >
              {version.levels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </SimpleTooltip>
        ) : null}

        <section className="rounded border border-line bg-panel/90 p-3">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">立面分区</h2>
            <SimpleTooltip title="为建筑四个边设置不同的立面策略和窗墙比">
              <Info className="h-3.5 w-3.5 text-muted" />
            </SimpleTooltip>
          </div>
          <div className="space-y-2">
            {zones.map((zone) => (
              <div className="rounded border border-line bg-[#0b1118] p-3 text-xs" key={zone.id}>
                <div className="mb-2 font-medium capitalize text-slate-100">{zone.edge} 立面</div>
                <label className="mb-2 block">
                  <div className="flex items-center gap-1.5 text-muted mb-1.5">
                    <span>立面策略</span>
                    <SimpleTooltip title="选择该方向立面的构造策略">
                      <Info className="h-3 w-3 text-muted" />
                    </SimpleTooltip>
                  </div>
                  <select
                    className="h-8 w-full rounded border border-line bg-[#0a0f15] px-2 text-slate-100 hover:border-accent/50 focus:border-accent outline-none transition-colors"
                    value={zone.strategy}
                    onChange={(event) =>
                      onUpdateFacadeZone?.(zone.id, {
                        strategy: event.target.value as FacadeEnvelope["zones"][number]["strategy"]
                      })
                    }
                  >
                    {strategyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="flex items-center gap-1.5 text-muted mb-1.5">
                    <span>目标窗墙比</span>
                    <SimpleTooltip title="该立面的窗户面积占墙体面积的目标比例">
                      <Info className="h-3 w-3 text-muted" />
                    </SimpleTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 h-8 rounded border border-line bg-[#0a0f15] px-2 text-slate-100 hover:border-accent/50 focus:border-accent outline-none transition-colors"
                      max={1}
                      min={0}
                      step={0.05}
                      type="number"
                      value={zone.targetWindowRatio ?? facadeEnvelope?.defaultWindowRatio ?? 0.35}
                      onChange={(event) => {
                        const value = Math.max(0, Math.min(1, Number(event.target.value)));
                        onUpdateFacadeZone?.(zone.id, { targetWindowRatio: value });
                      }}
                    />
                    <span className="text-xs text-muted w-12 text-right">
                      {Math.round((zone.targetWindowRatio ?? facadeEnvelope?.defaultWindowRatio ?? 0.35) * 100)}%
                    </span>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid min-h-[520px] grid-rows-[auto_minmax(0,1fr)] gap-3 rounded border border-line bg-panel/90 p-3">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Info className="h-3.5 w-3.5" />
          <span>周边预览 — 彩色边线对应立面分区策略</span>
        </div>
        <div className="min-h-0 overflow-hidden rounded border border-line bg-[#0b1118]">
          <svg className="h-full w-full" viewBox={getViewBox(version)}>
            <OutlineLayer version={version} />
            {resolvedLevel ? <RoomFillLayer rooms={resolvedLevel.rooms} /> : null}
            <GridLayer version={version} />
            <FacadeOverlayLayer version={version} facadeEnvelope={facadeEnvelope} levelId={activeLevel?.id} />
          </svg>
        </div>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-slate-100">{value}</dd>
    </div>
  );
}
