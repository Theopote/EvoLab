"use client";

import { useMemo, useState } from "react";
import { PencilLine, RotateCcw, Ruler, Trash2, Wand2 } from "lucide-react";
import { ImportReviewCanvas, type ImportReviewMode } from "@/components/workflow/import/ImportReviewCanvas";
import {
  applyImportReviewRooms,
  createTracedImportRoom,
  removeImportReviewRoom,
  resolveImportReviewRooms
} from "@/lib/import-review-utils";
import { buildVersionWallPreviewDataUrl } from "@/lib/import-reference-preview";
import { applyScaleCalibration } from "@/lib/plan-import/scale-calibration";
import type { PlanVersion, Point } from "@/lib/project-types";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface TraceReviewEditorProps {
  draftVersion: PlanVersion;
  recognizedVersion?: PlanVersion;
  fileName: string;
  sourceType: PlanImportSource;
  referencePreviewUrl?: string;
  onDraftVersionChange: (version: PlanVersion) => void;
}

export function TraceReviewEditor({
  draftVersion,
  recognizedVersion,
  fileName,
  sourceType,
  referencePreviewUrl,
  onDraftVersionChange
}: TraceReviewEditorProps) {
  const [mode, setMode] = useState<ImportReviewMode>("vertices");
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>();
  const [referenceOpacity, setReferenceOpacity] = useState(0.45);
  const [scalePoints, setScalePoints] = useState<Point[]>([]);
  const [knownDistanceM, setKnownDistanceM] = useState("");
  const [scalePickActive, setScalePickActive] = useState(false);

  const rooms = resolveImportReviewRooms(draftVersion);
  const effectiveReferencePreviewUrl = useMemo(() => {
    if (sourceType === "dxf") {
      return buildVersionWallPreviewDataUrl(draftVersion);
    }

    return referencePreviewUrl;
  }, [draftVersion, referencePreviewUrl, sourceType]);

  const scaleCalibrationActive = scalePickActive && scalePoints.length < 2;

  function handleTracePolygon(polygon: PlanVersion["rooms"][number]["polygon"]) {
    const levelId = draftVersion.levels[0]?.id ?? "level-01";
    const nextRoom = createTracedImportRoom(polygon, levelId, rooms.length + 1);
    onDraftVersionChange(applyImportReviewRooms(draftVersion, [...rooms, nextRoom]));
    setSelectedRoomId(nextRoom.id);
    setMode("vertices");
  }

  function handleScalePointAdd(point: Point) {
    if (!scaleCalibrationActive) {
      return;
    }

    setScalePoints((current) => (current.length >= 2 ? current : [...current, point]));
  }

  function applyScaleCalibrationFromPoints() {
    const distance = Number(knownDistanceM);
    if (scalePoints.length !== 2 || !Number.isFinite(distance) || distance <= 0) {
      return;
    }

    onDraftVersionChange(applyScaleCalibration(draftVersion, scalePoints[0]!, scalePoints[1]!, distance));
    setScalePoints([]);
    setScalePickActive(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <ModeButton active={mode === "vertices"} icon={PencilLine} label="编辑顶点" onClick={() => setMode("vertices")} />
          <ModeButton active={mode === "trace"} icon={Wand2} label="追踪房间" onClick={() => setMode("trace")} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Ruler className="h-3.5 w-3.5 text-muted" />
          <input
            className="h-8 w-24 rounded border border-line bg-[#0b1118] px-2 text-slate-100 outline-none focus:border-accent/50"
            placeholder="距离 m"
            type="number"
            min={0}
            step="0.1"
            value={knownDistanceM}
            onChange={(event) => {
              setKnownDistanceM(event.target.value);
              setScalePoints([]);
            }}
          />
          <button
            className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
            disabled={!knownDistanceM}
            type="button"
            onClick={() => {
              setScalePickActive(true);
              setScalePoints([]);
            }}
          >
            图上标定
          </button>
          <button
            className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
            disabled={scalePoints.length !== 2 || !knownDistanceM}
            type="button"
            onClick={applyScaleCalibrationFromPoints}
          >
            应用比例尺
          </button>
          {scalePickActive ? (
            <button
              className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:text-slate-100"
              type="button"
              onClick={() => {
                setScalePickActive(false);
                setScalePoints([]);
              }}
            >
              取消标定
            </button>
          ) : null}
        </div>
      </div>

      {scalePickActive ? (
        <p className="text-[11px] text-muted">
          比例尺标定：在图上点击两个端点（{scalePoints.length}/2），对应实际距离 {knownDistanceM} m。
        </p>
      ) : null}

      <ImportReviewCanvas
        className="min-h-[360px] flex-1"
        mode={mode}
        referenceImage={
          effectiveReferencePreviewUrl
            ? {
                opacity: referenceOpacity,
                previewUrl: effectiveReferencePreviewUrl
              }
            : undefined
        }
        scaleCalibrationActive={scaleCalibrationActive}
        scaleCalibrationPoints={scalePoints}
        selectedRoomId={selectedRoomId}
        version={draftVersion}
        onScalePointAdd={handleScalePointAdd}
        onSelectRoom={setSelectedRoomId}
        onTracePolygon={handleTracePolygon}
        onVersionChange={onDraftVersionChange}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs">
        <button
          className="rounded border border-line px-2 py-1 text-muted hover:border-danger/50 hover:text-danger disabled:opacity-40"
          disabled={!selectedRoomId}
          type="button"
          onClick={() => {
            if (!selectedRoomId) {
              return;
            }

            onDraftVersionChange(removeImportReviewRoom(draftVersion, selectedRoomId));
            setSelectedRoomId(undefined);
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Trash2 className="h-3.5 w-3.5" />
            删除房间
          </span>
        </button>
        {recognizedVersion ? (
          <button
            className="rounded border border-line px-2 py-1 text-muted hover:border-accent/50 hover:text-accent"
            type="button"
            onClick={() => {
              onDraftVersionChange(recognizedVersion);
              setSelectedRoomId(undefined);
              setScalePoints([]);
            }}
          >
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              重置识别结果
            </span>
          </button>
        ) : null}
        {effectiveReferencePreviewUrl ? (
          <label className="ml-auto flex items-center gap-2 text-muted">
            参考图
            <input
              className="w-24 accent-accent"
              max={100}
              min={10}
              type="range"
              value={Math.round(referenceOpacity * 100)}
              onChange={(event) => setReferenceOpacity(Number(event.target.value) / 100)}
            />
          </label>
        ) : null}
        <span className="text-muted">{fileName}</span>
      </div>
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
