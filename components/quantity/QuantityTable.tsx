"use client";

import { Download, FileText } from "lucide-react";
import { MetricsScopeToggle } from "@/components/inspector/MetricsScopeToggle";
import type { ScheduleBundle } from "@/lib/building-domain";
import type { PlanScopeKind } from "@/lib/plan-scope";
import type { QuantityResult } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

interface QuantityTableProps {
  quantities: QuantityResult;
  activeSchedule?: ScheduleBundle;
  includeSchedules?: boolean;
  version?: PlanVersion;
  activeLevelId?: string;
  metricsScope?: PlanScopeKind;
  onMetricsScopeChange?: (scope: PlanScopeKind) => void;
}

export function QuantityTable({
  quantities,
  activeSchedule,
  includeSchedules = true,
  version,
  activeLevelId,
  metricsScope,
  onMetricsScopeChange
}: QuantityTableProps) {
  const roomSchedule = activeSchedule?.tables.find((table) => table.kind === "room");
  const openingSchedule = activeSchedule?.tables.find((table) => table.kind === "door_window");

  return (
    <section className="space-y-4">
      <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Quantity Takeoff</h1>
          <p className="mt-1 text-xs text-muted">Calculated from active scheme geometry at the selected metrics scope.</p>
        </div>
        <div className="flex gap-2">
          <button className="flex h-8 items-center gap-2 rounded border border-line px-2 text-xs text-slate-200 hover:border-accent/60" type="button">
            <FileText className="h-3.5 w-3.5" />
            Basis
          </button>
          <button className="flex h-8 items-center gap-2 rounded border border-line px-2 text-xs text-slate-200 hover:border-accent/60" type="button">
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {metricsScope && onMetricsScopeChange ? (
        <div className="mb-4 rounded border border-line bg-[#0b1118] p-3">
          <MetricsScopeToggle
            activeLevelId={activeLevelId}
            scope={metricsScope}
            version={version}
            onScopeChange={onMetricsScopeChange}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Basis</th>
            </tr>
          </thead>
          <tbody>
            {quantities.rows.map((row) => (
              <tr className="border-t border-line/80" key={row.id}>
                <td className="px-3 py-2 text-slate-100">{row.label}</td>
                <td className="px-3 py-2 text-right text-slate-100">{row.value.toLocaleString()}</td>
                <td className="px-3 py-2 text-muted">{row.unit}</td>
                <td className="px-3 py-2 text-xs text-muted">{row.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <AreaBreakdown title="Area by zone" data={quantities.areaByZone} />
        <AreaBreakdown title="Area by room type" data={quantities.areaByRoomType} />
      </div>
      </section>

      {includeSchedules && roomSchedule ? (
        <SchedulePanel
          title={roomSchedule.title}
          columns={roomSchedule.columns}
          rows={roomSchedule.rows.slice(0, 12)}
          footer={roomSchedule.rows.length > 12 ? `Showing 12 of ${roomSchedule.rows.length} rows` : undefined}
        />
      ) : null}

      {includeSchedules && openingSchedule ? (
        <SchedulePanel
          title={openingSchedule.title}
          columns={openingSchedule.columns}
          rows={openingSchedule.rows.slice(0, 8)}
          footer={openingSchedule.rows.length > 8 ? `Showing 8 of ${openingSchedule.rows.length} rows` : undefined}
        />
      ) : null}
    </section>
  );
}

function SchedulePanel({
  title,
  columns,
  rows,
  footer
}: {
  title: string;
  columns: string[];
  rows: Array<{ id: string; values: Record<string, string | number> }>;
  footer?: string;
}) {
  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {footer ? <span className="text-xs text-muted">{footer}</span> : null}
      </div>
      <div className="overflow-hidden rounded border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              {columns.map((column) => (
                <th className="px-3 py-2" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-t border-line/80" key={row.id}>
                {columns.map((column) => (
                  <td className="px-3 py-2 text-slate-100" key={`${row.id}-${column}`}>
                    {row.values[column] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AreaBreakdown({ title, data }: { title: string; data: Record<string, number | undefined> }) {
  const rows = Object.entries(data).filter(([, value]) => value && value > 0);

  return (
    <div className="rounded border border-line bg-[#0b1118] p-3">
      <h2 className="mb-2 text-sm font-medium text-white">{title}</h2>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div className="flex items-center justify-between text-xs" key={label}>
            <span className="text-muted">{label}</span>
            <span className="text-slate-100">{Math.round(value ?? 0).toLocaleString()} sqm</span>
          </div>
        ))}
      </div>
    </div>
  );
}
