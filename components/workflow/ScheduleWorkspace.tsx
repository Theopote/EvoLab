"use client";

import type { ScheduleBundle } from "@/lib/building-domain";

interface ScheduleWorkspaceProps {
  activeSchedule?: ScheduleBundle;
}

export function ScheduleWorkspace({ activeSchedule }: ScheduleWorkspaceProps) {
  if (!activeSchedule) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to build room and opening schedules.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded border border-line bg-panel/90 p-3">
        <h1 className="text-base font-semibold text-white">Schedules</h1>
        <p className="mt-1 text-xs text-muted">
          Derived from active scheme · version {activeSchedule.versionId} · {activeSchedule.tables.length} table
          {activeSchedule.tables.length === 1 ? "" : "s"}
        </p>
      </header>

      {activeSchedule.tables.map((table) => (
        <ScheduleTable
          key={table.id}
          title={table.title}
          columns={table.columns}
          rows={table.rows}
        />
      ))}
    </section>
  );
}

function ScheduleTable({
  title,
  columns,
  rows
}: {
  title: string;
  columns: string[];
  rows: Array<{ id: string; values: Record<string, string | number> }>;
}) {
  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-muted">{rows.length} rows</span>
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
