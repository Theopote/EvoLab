"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, PencilLine, RotateCcw, Ruler, Trash2, Wand2 } from "lucide-react";
import { ImportReviewCanvas, type ImportReviewMode } from "@/components/workflow/import/ImportReviewCanvas";
import {
  applyImportReviewRooms,
  createTracedImportRoom,
  importReviewRoomTypes,
  importReviewZones,
  recalculateImportReviewAreas,
  removeImportReviewRoom,
  resolveImportReviewRooms,
  updateImportReviewRoom,
  validateImportReviewDraft
} from "@/lib/import-review-utils";
import { buildVersionWallPreviewDataUrl } from "@/lib/import-reference-preview";
import { applyScaleCalibration } from "@/lib/plan-import/scale-calibration";
import type { FunctionZone, PlanVersion, Point, RoomType } from "@/lib/project-types";
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
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const validationIssues = useMemo(() => validateImportReviewDraft(draftVersion), [draftVersion]);

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

  function handleRoomPatch(patch: Partial<{ name: string; type: RoomType; zone: FunctionZone }>) {
    if (!selectedRoomId) {
      return;
    }

    onDraftVersionChange(updateImportReviewRoom(draftVersion, selectedRoomId, patch));
  }

  function handleRecalculateAreas() {
    onDraftVersionChange(recalculateImportReviewAreas(draftVersion));
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

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <ImportReviewCanvas
          className="min-h-[360px]"
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

        <aside className="flex min-h-0 flex-col gap-3 overflow-hidden rounded border border-line bg-panel/50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">房间列表</h3>
            <button
              className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] text-muted hover:border-accent/50 hover:text-accent"
              type="button"
              onClick={handleRecalculateAreas}
            >
              <Calculator className="h-3 w-3" />
              重算面积
            </button>
          </div>

          <ul className="max-h-40 space-y-1 overflow-auto">
            {rooms.map((room) => {
              const roomIssues = validationIssues.filter((issue) => issue.roomIds?.includes(room.id));
              const isSelected = room.id === selectedRoomId;

              return (
                <li key={room.id}>
                  <button
                    className={`flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left transition ${
                      isSelected ? "bg-accent/15 text-accent ring-1 ring-accent/30" : "hover:bg-canvas/60"
                    }`}
                    type="button"
                    onClick={() => setSelectedRoomId(room.id)}
                  >
                    <span className="min-w-0 truncate">
                      {room.name}
                      {roomIssues.length ? (
                        <AlertTriangle className="ml-1 inline h-3 w-3 text-amber-300" />
                      ) : null}
                    </span>
                    <span className={`shrink-0 ${isSelected ? "text-accent/80" : "text-muted"}`}>
                      {room.areaSqm} ㎡
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedRoom ? (
            <section className="space-y-2 border-t border-line pt-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">房间属性</h4>
              <label className="block">
                <span className="text-muted">名称</span>
                <input
                  className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                  value={selectedRoom.name}
                  onChange={(event) => handleRoomPatch({ name: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-muted">类型</span>
                <select
                  className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                  value={selectedRoom.type}
                  onChange={(event) => handleRoomPatch({ type: event.target.value as RoomType })}
                >
                  {importReviewRoomTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-muted">功能分区</span>
                <select
                  className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                  value={selectedRoom.zone}
                  onChange={(event) => handleRoomPatch({ zone: event.target.value as FunctionZone })}
                >
                  {importReviewZones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : (
            <p className="border-t border-line pt-3 text-muted">选择房间后可编辑名称、类型与功能分区。</p>
          )}

          <section className="min-h-0 flex-1 border-t border-line pt-3">
            <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              几何检查 ({validationIssues.length})
            </h4>
            {validationIssues.length ? (
              <ul className="max-h-32 space-y-1 overflow-auto">
                {validationIssues.map((issue, index) => (
                  <li
                    className={`rounded px-2 py-1 ${
                      issue.severity === "error" ? "bg-danger/10 text-danger" : "bg-amber-500/10 text-amber-200"
                    }`}
                    key={`${issue.id}-${index}`}
                  >
                    <button
                      className="w-full text-left"
                      type="button"
                      onClick={() => issue.roomIds?.[0] && setSelectedRoomId(issue.roomIds[0])}
                    >
                      {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-success">未发现未闭合、重叠或面积异常问题。</p>
            )}
          </section>
        </aside>
      </div>

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
