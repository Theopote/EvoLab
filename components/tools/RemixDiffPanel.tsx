"use client";

import type { ReactNode } from "react";
import { AlertTriangle, ArrowRightLeft, Info, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import {
  buildRemixDiffReport,
  formatAreaDelta,
  type RemixRoomDiffEntry,
  type RemixRisk
} from "@/lib/retained-structure/remix-diff";
import type { RetainedStructureRemixParameters } from "@/lib/retained-structure/remix-parameters";
import {
  REMIX_CORRIDOR_STRATEGY_LABELS,
  REMIX_FUNCTIONAL_TYPE_LABELS
} from "@/lib/retained-structure/remix-parameters";
import type { PlanVersion } from "@/lib/project-types";

interface RemixDiffPanelProps {
  before: PlanVersion;
  after: PlanVersion;
  parameters: RetainedStructureRemixParameters;
  focusedRoomId?: string;
  onRoomFocus?: (entry: RemixRoomDiffEntry) => void;
}

export function RemixDiffPanel({
  before,
  after,
  parameters,
  focusedRoomId,
  onRoomFocus
}: RemixDiffPanelProps) {
  const report = useMemo(
    () => buildRemixDiffReport(before, after, parameters),
    [after, before, parameters]
  );

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded border border-success/40 bg-success/10 p-3 text-success">
        已重划 {report.summary.relayoutedCount} 个非结构房间 · {REMIX_FUNCTIONAL_TYPE_LABELS[parameters.targetFunctionalType]} ·{" "}
        {REMIX_CORRIDOR_STRATEGY_LABELS[parameters.corridorStrategy]} · 目标 {parameters.targetRoomCount} 间
      </div>

      <section className="rounded border border-line bg-panel/70 p-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">重划说明</h3>
        <ul className="space-y-1.5 text-slate-200">
          {report.rationale.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-line bg-panel/70 p-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">变更概览</h3>
        <div className="grid grid-cols-2 gap-2 text-slate-200">
          <Stat label="锁定结构" value={String(report.summary.preservedStructureCount)} />
          <Stat label="未动程序房间" value={String(report.summary.unchangedProgramCount)} />
          <Stat label="几何变更" value={String(report.summary.modifiedCount)} />
          <Stat label="新增 / 移除" value={`${report.summary.addedCount} / ${report.summary.removedCount}`} />
          <Stat
            className="col-span-2"
            label="程序面积"
            value={`${report.summary.programAreaBefore} → ${report.summary.programAreaAfter} ㎡ (${formatAreaDelta(report.summary.programAreaDelta)})`}
          />
        </div>
      </section>

      <section className="rounded border border-line bg-panel/70 p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <ArrowRightLeft className="h-3 w-3" />
          功能分区变化
        </h3>
        <div className="space-y-1">
          {report.zoneSummary
            .filter((zone) => zone.beforeSqm > 0 || zone.afterSqm > 0)
            .map((zone) => (
              <div className="flex items-center justify-between gap-2 text-slate-200" key={zone.zone}>
                <span className="text-muted">{zone.label}</span>
                <span>
                  {zone.beforeShare}% → {zone.afterShare}%
                  <span className={`ml-1 ${zone.deltaSqm === 0 ? "text-muted" : zone.deltaSqm > 0 ? "text-sky-300" : "text-amber-300"}`}>
                    ({formatAreaDelta(zone.deltaSqm)})
                  </span>
                </span>
              </div>
            ))}
        </div>
      </section>

      {report.unchanged.length ? (
        <RoomList
          entries={report.unchanged}
          focusedRoomId={focusedRoomId}
          icon={<Minus className="h-3 w-3 text-muted" />}
          title="未动房间"
          onRoomFocus={onRoomFocus}
        />
      ) : null}

      {report.changed.length ? (
        <RoomList
          entries={report.changed}
          focusedRoomId={focusedRoomId}
          icon={<ArrowRightLeft className="h-3 w-3 text-emerald-400" />}
          showDelta
          title="变化房间"
          onRoomFocus={onRoomFocus}
        />
      ) : null}

      {report.added.length ? (
        <RoomList
          entries={report.added}
          focusedRoomId={focusedRoomId}
          icon={<Plus className="h-3 w-3 text-sky-400" />}
          showDelta
          title="新增房间"
          onRoomFocus={onRoomFocus}
        />
      ) : null}

      {report.removed.length ? (
        <RoomList
          entries={report.removed}
          focusedRoomId={focusedRoomId}
          icon={<Minus className="h-3 w-3 text-rose-400" />}
          title="移除房间"
          onRoomFocus={onRoomFocus}
        />
      ) : null}

      {report.preserved.length ? (
        <RoomList
          entries={report.preserved}
          focusedRoomId={focusedRoomId}
          icon={<Minus className="h-3 w-3 text-muted" />}
          title="锁定结构房间"
          onRoomFocus={onRoomFocus}
        />
      ) : null}

      {report.risks.length ? (
        <section className="rounded border border-line bg-panel/70 p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">风险提示</h3>
          <ul className="space-y-1.5">
            {report.risks.map((risk) => (
              <RiskItem key={risk.id} risk={risk} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 font-medium text-slate-100">{value}</div>
    </div>
  );
}

function RoomList({
  title,
  entries,
  icon,
  showDelta,
  focusedRoomId,
  onRoomFocus
}: {
  title: string;
  entries: RemixRoomDiffEntry[];
  icon: ReactNode;
  showDelta?: boolean;
  focusedRoomId?: string;
  onRoomFocus?: (entry: RemixRoomDiffEntry) => void;
}) {
  return (
    <section className="rounded border border-line bg-panel/70 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {icon}
        {title}
        <span className="font-normal normal-case tracking-normal text-muted">({entries.length})</span>
      </h3>
      <ul className="max-h-36 space-y-1 overflow-auto text-slate-200">
        {entries.map((entry) => {
          const isFocused = focusedRoomId === entry.id;

          return (
            <li key={entry.id}>
              <button
                className={`flex w-full items-start justify-between gap-2 rounded px-1.5 py-1 text-left transition ${
                  isFocused
                    ? "bg-accent/15 text-accent ring-1 ring-accent/30"
                    : onRoomFocus
                      ? "hover:bg-canvas/60"
                      : ""
                }`}
                type="button"
                onClick={() => onRoomFocus?.(entry)}
              >
                <span className="min-w-0 truncate">
                  {entry.name}
                  {entry.typeChanged ? (
                    <span className="ml-1 text-muted">
                      · {entry.typeChanged.from} → {entry.typeChanged.to}
                    </span>
                  ) : null}
                  {entry.zoneChanged ? (
                    <span className="ml-1 text-muted">
                      · {entry.zoneChanged.from} → {entry.zoneChanged.to}
                    </span>
                  ) : null}
                </span>
                {showDelta ? (
                  <span className={`shrink-0 ${isFocused ? "text-accent/80" : "text-muted"}`}>
                    {formatAreaDelta(entry.areaDeltaSqm ?? entry.afterAreaSqm)}
                  </span>
                ) : entry.afterAreaSqm !== undefined ? (
                  <span className={`shrink-0 ${isFocused ? "text-accent/80" : "text-muted"}`}>
                    {entry.afterAreaSqm} ㎡
                  </span>
                ) : entry.beforeAreaSqm !== undefined ? (
                  <span className={`shrink-0 ${isFocused ? "text-accent/80" : "text-muted"}`}>
                    {entry.beforeAreaSqm} ㎡
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RiskItem({ risk }: { risk: RemixRisk }) {
  const Icon = risk.level === "warning" ? AlertTriangle : Info;
  const tone = risk.level === "warning" ? "text-amber-300" : "text-sky-300";

  return (
    <li className={`flex items-start gap-2 ${tone}`}>
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{risk.message}</span>
    </li>
  );
}
