"use client";

import { Columns3, Layers3, Info } from "lucide-react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { VerticalAlignmentPanel } from "@/components/workflow/VerticalAlignmentPanel";
import { StructureOverlayLayer } from "@/components/workflow/layers/StructureOverlayLayer";
import { SimpleTooltip } from "@/components/ui/Tooltip";
import type { StoreyStack, StructuralSystem, VerticalCirculationSystem } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

interface StructureWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  structuralSystem?: StructuralSystem;
  storeyStack?: StoreyStack;
  verticalCirculation?: VerticalCirculationSystem;
  onLevelChange: (levelId: string) => void;
  onUpdateStructuralSystem?: (patch: Pick<StructuralSystem, "gridSpacingMeters" | "maxSpanMeters">) => void;
}

export function StructureWorkspace({
  version,
  activeLevelId,
  structuralSystem,
  storeyStack,
  verticalCirculation,
  onLevelChange,
  onUpdateStructuralSystem
}: StructureWorkspaceProps) {
  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div>
          <Columns3 className="mx-auto h-12 w-12 text-muted" />
          <p className="mt-3 text-sm text-muted">生成或选择方案版本以查看结构网格和竖向对齐</p>
        </div>
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const levelColumns = structuralSystem?.columns.filter((column) => column.levelId === activeLevel?.id).length ?? 0;

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)_minmax(220px,0.55fr)] gap-4">
      <header className="rounded border border-line bg-panel/90 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="flex items-center gap-2 text-base font-semibold text-white">
                <Columns3 className="h-4 w-4 text-accent" />
                结构建议
              </h1>
              <SimpleTooltip title="基于平面布局自动生成结构网格、柱位和竖向交通核心">
                <Info className="h-3.5 w-3.5 text-muted" />
              </SimpleTooltip>
            </div>
            <p className="mt-1 text-xs text-muted">
              根据有效方案派生的网格柱、楼层组和竖向核心对齐
            </p>
          </div>
          {version.levels.length > 1 ? (
            <SimpleTooltip title="选择要查看结构的楼层">
              <select
                className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100 hover:border-accent/50 transition-colors"
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
        </div>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)] gap-4">
        <aside className="space-y-3 overflow-auto">
          <SimpleTooltip title="结构网格的标准间距，通常为柱网尺寸" side="right">
            <div>
              <EditableMetric
                label="网格间距 (m)"
                value={structuralSystem?.gridSpacingMeters ?? 12}
                step={0.5}
                min={3}
                max={30}
                onChange={(value) => onUpdateStructuralSystem?.({ gridSpacingMeters: value, maxSpanMeters: structuralSystem?.maxSpanMeters ?? value * 2 })}
              />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="结构体系允许的最大跨度距离" side="right">
            <div>
              <EditableMetric
                label="最大跨度 (m)"
                value={structuralSystem?.maxSpanMeters ?? 24}
                step={0.5}
                min={5}
                max={50}
                onChange={(value) =>
                  onUpdateStructuralSystem?.({
                    gridSpacingMeters: structuralSystem?.gridSpacingMeters ?? 12,
                    maxSpanMeters: value
                  })
                }
              />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="当前楼层的结构柱数量" side="right">
            <div>
              <MetricCard label="本层柱数" value={String(levelColumns)} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="整个建筑的结构柱总数" side="right">
            <div>
              <MetricCard label="总柱数" value={String(structuralSystem?.columns.length ?? 0)} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="楼层堆栈中的楼层组数量" side="right">
            <div>
              <MetricCard label="楼层组数" value={String(storeyStack?.groups.length ?? 0)} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="建筑物的总高度（米）" side="right">
            <div>
              <MetricCard label="建筑高度" value={`${storeyStack?.totalHeightMeters.toFixed(1) ?? "—"} m`} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="竖向交通系统中的楼梯段数量" side="right">
            <div>
              <MetricCard label="楼梯段数" value={String(verticalCirculation?.stairRuns.length ?? 0)} />
            </div>
          </SimpleTooltip>
          <SimpleTooltip title="电梯组的数量" side="right">
            <div>
              <MetricCard label="电梯组数" value={String(verticalCirculation?.elevatorGroups.length ?? 0)} />
            </div>
          </SimpleTooltip>

          {storeyStack?.groups.length ? (
            <section className="rounded border border-line bg-[#0b1118] p-3 text-xs">
              <div className="mb-2 flex items-center gap-2 font-medium text-white">
                <Layers3 className="h-3.5 w-3.5 text-accent" />
                楼层堆栈
              </div>
              <div className="space-y-2">
                {storeyStack.groups.map((group) => (
                  <div className="rounded border border-line p-2" key={group.id}>
                    <div className="text-slate-100">{group.label}</div>
                    <div className="mt-1 text-muted">{group.levelIds.length} 层</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </aside>

        <section className="min-h-[420px] overflow-hidden rounded border border-line bg-[#0b1118]">
          <svg className="h-full w-full" viewBox={getViewBox(version)}>
            <OutlineLayer version={version} />
            {resolvedLevel ? <RoomFillLayer rooms={resolvedLevel.rooms} /> : null}
            <GridLayer version={version} />
            <StructureOverlayLayer structuralSystem={structuralSystem} levelId={activeLevel?.id} />
          </svg>
        </section>
      </div>

      <VerticalAlignmentPanel version={version} activeLevelId={activeLevel?.id} />
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel/90 px-3 py-2 text-xs">
      <div className="text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function EditableMetric({
  label,
  value,
  step,
  min,
  max,
  onChange
}: {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded border border-line bg-panel/90 px-3 py-2 text-xs">
      <span className="text-muted">{label}</span>
      <input
        className="mt-1 h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 hover:border-accent/50 focus:border-accent outline-none transition-colors"
        step={step}
        min={min}
        max={max}
        type="number"
        value={value}
        onChange={(event) => {
          let newValue = Number(event.target.value);
          if (min !== undefined) newValue = Math.max(min, newValue);
          if (max !== undefined) newValue = Math.min(max, newValue);
          onChange(newValue);
        }}
      />
    </label>
  );
}
