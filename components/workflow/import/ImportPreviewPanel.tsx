"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Layers,
  PencilLine,
  RotateCcw,
  Shapes,
  Trash2,
  Wand2
} from "lucide-react";
import { ImportReviewCanvas, type ImportReviewMode } from "@/components/workflow/import/ImportReviewCanvas";
import {
  applyImportReviewRooms,
  createTracedImportRoom,
  removeImportReviewRoom,
  resolveImportReviewRooms
} from "@/lib/import-review-utils";
import type { PlanVersion } from "@/lib/project-types";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface ImportPreviewPanelProps {
  draftVersion: PlanVersion;
  recognizedVersion: PlanVersion;
  fileName: string;
  sourceType: PlanImportSource;
  importPath: "vision" | "structured";
  confidence: number;
  warnings: string[];
  fallback?: boolean;
  referencePreviewUrl?: string;
  onDraftVersionChange: (version: PlanVersion) => void;
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
  draftVersion,
  recognizedVersion,
  fileName,
  sourceType,
  importPath,
  confidence,
  warnings,
  fallback,
  referencePreviewUrl,
  onDraftVersionChange
}: ImportPreviewPanelProps) {
  const [mode, setMode] = useState<ImportReviewMode>("vertices");
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [referenceOpacity, setReferenceOpacity] = useState(0.45);

  const rooms = resolveImportReviewRooms(draftVersion);
  const wallCount = draftVersion.levels.reduce((total, level) => total + level.walls.length, 0);
  const openingCount = draftVersion.levels.reduce((total, level) => total + level.openings.length, 0);
  const confidencePercent = Math.round(confidence * 100);
  const hasCorrections = useMemo(
    () => JSON.stringify(resolveImportReviewRooms(recognizedVersion)) !== JSON.stringify(rooms),
    [recognizedVersion, rooms]
  );

  function handleTracePolygon(polygon: PlanVersion["rooms"][number]["polygon"]) {
    const levelId = draftVersion.levels[0]?.id ?? "level-01";
    const nextRoom = createTracedImportRoom(polygon, levelId, rooms.length + 1);
    onDraftVersionChange(applyImportReviewRooms(draftVersion, [...rooms, nextRoom]));
    setSelectedRoomId(nextRoom.id);
    setMode("vertices");
  }

  function handleDeleteSelectedRoom() {
    if (!selectedRoomId) {
      return;
    }

    const nextVersion = removeImportReviewRoom(draftVersion, selectedRoomId);
    onDraftVersionChange(nextVersion);
    setSelectedRoomId(undefined);
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <section className="min-h-0 rounded border border-line bg-[#081018] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Review & correct</h2>
            <p className="mt-1 text-xs text-muted">
              Drag room vertices, trace missing rooms, or remove false detections before creating the scheme version.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModeButton active={mode === "vertices"} icon={PencilLine} label="Edit vertices" onClick={() => setMode("vertices")} />
            <ModeButton active={mode === "trace"} icon={Wand2} label="Trace room" onClick={() => setMode("trace")} />
          </div>
        </div>

        <ImportReviewCanvas
          className="min-h-[420px]"
          mode={mode}
          referenceImage={
            referencePreviewUrl
              ? {
                  opacity: referenceOpacity,
                  previewUrl: referencePreviewUrl
                }
              : undefined
          }
          selectedRoomId={selectedRoomId}
          version={draftVersion}
          onSelectRoom={setSelectedRoomId}
          onTracePolygon={handleTracePolygon}
          onVersionChange={onDraftVersionChange}
        />
      </section>

      <aside className="space-y-3">
        <section className="rounded border border-line bg-panel/90 p-4">
          <h3 className="text-sm font-semibold text-white">Correction tools</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40"
              disabled={!selectedRoomId}
              type="button"
              onClick={handleDeleteSelectedRoom}
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Delete room
              </span>
            </button>
            <button
              className="rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40"
              disabled={!hasCorrections}
              type="button"
              onClick={() => {
                onDraftVersionChange(recognizedVersion);
                setSelectedRoomId(undefined);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset corrections
              </span>
            </button>
          </div>
          {referencePreviewUrl ? (
            <label className="mt-4 flex items-center gap-2 text-xs text-muted">
              <span>Reference</span>
              <input
                className="flex-1 accent-accent"
                max={100}
                min={10}
                type="range"
                value={Math.round(referenceOpacity * 100)}
                onChange={(event) => setReferenceOpacity(Number(event.target.value) / 100)}
              />
              <span className="w-8 text-right text-slate-100">{Math.round(referenceOpacity * 100)}%</span>
            </label>
          ) : null}
          {hasCorrections ? (
            <p className="mt-3 text-xs text-accent">Manual corrections will be saved with the imported version.</p>
          ) : null}
        </section>

        <section className="rounded border border-line bg-panel/90 p-4">
          <h3 className="text-sm font-semibold text-white">Rooms</h3>
          <div className="mt-3 max-h-44 space-y-2 overflow-auto">
            {rooms.length ? (
              rooms.map((room) => (
                <button
                  className={`flex w-full items-center justify-between rounded border px-2 py-2 text-left text-xs transition ${
                    selectedRoomId === room.id
                      ? "border-accent/50 bg-accent/10 text-slate-100"
                      : "border-line bg-[#0b1118] text-muted hover:text-slate-100"
                  }`}
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(room.id);
                    setMode("vertices");
                  }}
                >
                  <span>{room.name}</span>
                  <span>{room.areaSqm} sqm</span>
                </button>
              ))
            ) : (
              <p className="text-xs text-muted">No rooms detected yet. Switch to trace mode to add one.</p>
            )}
          </div>
        </section>

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
              Low confidence — correct boundaries here or continue into trace mode after import.
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
            <MetricCard icon={Shapes} label="Rooms" value={rooms.length} />
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

function ModeButton({
  active,
  label,
  icon: Icon,
  onClick
}: {
  active: boolean;
  label: string;
  icon: typeof PencilLine;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-[11px] transition ${
        active ? "border-accent/50 bg-accent/10 text-accent" : "border-line text-muted hover:text-slate-100"
      }`}
      type="button"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
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
