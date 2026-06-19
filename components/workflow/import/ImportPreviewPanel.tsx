"use client";

import { AlertTriangle, CheckCircle2, DoorOpen, Layers, Shapes } from "lucide-react";
import { FloorPlan } from "@/components/floor-plan";
import type { PlanVersion } from "@/lib/project-types";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface ImportPreviewPanelProps {
  version: PlanVersion;
  fileName: string;
  sourceType: PlanImportSource;
  importPath: "vision" | "structured";
  confidence: number;
  warnings: string[];
  fallback?: boolean;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.75) {
    return "text-emerald-300";
  }

  if (confidence >= 0.5) {
    return "text-amber-300";
  }

  return "text-rose-300";
}

export function ImportPreviewPanel({
  version,
  fileName,
  sourceType,
  importPath,
  confidence,
  warnings,
  fallback
}: ImportPreviewPanelProps) {
  const wallCount = version.levels.reduce((total, level) => total + level.walls.length, 0);
  const openingCount = version.levels.reduce((total, level) => total + level.openings.length, 0);
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section className="min-h-0 rounded border border-line bg-[#081018] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Recognized geometry</h2>
            <p className="mt-1 text-xs text-muted">Review rooms, walls, and openings before creating a scheme version.</p>
          </div>
          <span className="rounded border border-line px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted">
            {importPath}
          </span>
        </div>
        <FloorPlan version={version} interactive={false} className="min-h-[420px]" />
      </section>

      <aside className="space-y-3">
        <section className="rounded border border-line bg-panel/90 p-4">
          <h3 className="text-sm font-semibold text-white">Import summary</h3>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">File</dt>
              <dd className="truncate text-right text-slate-100">{fileName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Source</dt>
              <dd className="uppercase text-slate-100">{sourceType}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Path</dt>
              <dd className="text-slate-100">{importPath}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded border border-line bg-panel/90 p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Confidence</h3>
            <span className={`text-sm font-semibold ${confidenceTone(confidence)}`}>{confidencePercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded bg-[#0b1118]">
            <div
              className={`h-full rounded ${
                confidence >= 0.75 ? "bg-emerald-400" : confidence >= 0.5 ? "bg-amber-400" : "bg-rose-400"
              }`}
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          {fallback ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Recognition fell back to mock data. Check API keys or upload quality, then re-run import.
            </p>
          ) : confidence < 0.6 ? (
            <p className="mt-3 flex items-start gap-2 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Low confidence — open trace mode after import to correct room boundaries.
            </p>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-xs text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Geometry is usable as a starting point for refinement.
            </p>
          )}
        </section>

        <section className="rounded border border-line bg-panel/90 p-4">
          <h3 className="text-sm font-semibold text-white">Detected elements</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MetricCard icon={Shapes} label="Rooms" value={version.rooms.length} />
            <MetricCard icon={Layers} label="Walls" value={wallCount} />
            <MetricCard icon={DoorOpen} label="Openings" value={openingCount} />
          </div>
        </section>

        {warnings.length ? (
          <section className="rounded border border-amber-500/30 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold text-amber-100">Warnings</h3>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-amber-50/90">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Shapes;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-accent" />
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
    </div>
  );
}
