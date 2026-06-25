"use client";

import { RotateCcw } from "lucide-react";
import type { StructuralSystem } from "@/lib/building-domain";

interface StructureEditorPanelProps {
  structure?: StructuralSystem;
  levelCount?: number;
  onChange: (patch: Partial<StructuralSystem>) => void;
  onResetFromPlan: () => void;
}

export function StructureEditorPanel({
  structure,
  levelCount,
  onChange,
  onResetFromPlan
}: StructureEditorPanelProps) {
  if (!structure) {
    return (
      <section className="rounded border border-line bg-panel/90 p-6 text-sm text-muted">
        Generate or select a plan to derive structural grid data.
      </section>
    );
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Structural system</h2>
          <p className="mt-1 text-sm text-muted">Adjust grid assumptions used for alignment checks and structure-fit scoring.</p>
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-muted hover:border-accent hover:text-accent"
          type="button"
          onClick={onResetFromPlan}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset from plan
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Grid spacing (m)
          <input
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            min={3}
            max={24}
            step={0.5}
            type="number"
            value={structure.gridSpacingMeters}
            onChange={(event) => onChange({ gridSpacingMeters: Number(event.target.value) })}
          />
        </label>
        <label className="text-xs text-muted">
          Max span (m)
          <input
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            min={4}
            max={36}
            step={0.5}
            type="number"
            value={structure.maxSpanMeters}
            onChange={(event) => onChange({ maxSpanMeters: Number(event.target.value) })}
          />
        </label>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <dt className="text-muted">Columns</dt>
          <dd className="mt-1 text-slate-100">{structure.columns.length}</dd>
        </div>
        <div>
          <dt className="text-muted">Shear walls</dt>
          <dd className="mt-1 text-slate-100">{structure.shearWalls.length}</dd>
        </div>
        <div>
          <dt className="text-muted">Levels</dt>
          <dd className="mt-1 text-slate-100">{levelCount ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}
