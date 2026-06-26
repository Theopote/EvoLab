"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileJson, FileOutput, Layers, Loader2, PlusCircle, Save, Sparkles } from "lucide-react";
import { FloorPlanCanvas } from "@/components/floor-plan/FloorPlanCanvas";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { createPlanSvg, downloadTextFile, exportVersionJson } from "@/lib/export-utils";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";
import { remixRetainedStructureViaApi } from "@/lib/retained-structure/remix-client";
import {
  defaultRemixParameters,
  REMIX_CORRIDOR_STRATEGY_LABELS,
  REMIX_FUNCTIONAL_TYPE_LABELS,
  REMIX_LAYOUT_PRIORITY_LABELS,
  remixParametersFromRecord,
  remixParametersToRecord,
  type RemixCorridorStrategy,
  type RemixFunctionalType,
  type RemixLayoutPriority,
  type RetainedStructureRemixParameters
} from "@/lib/retained-structure/remix-parameters";
import { summarizeRetainedStructure, isRetainedStructureRoom } from "@/lib/retained-structure/structure-rooms";
import { createDemoProjectData } from "@/lib/typologies";
import type { TypologyPackId } from "@/lib/typology/types";
import {
  saveRetainedStructureRemixSession,
  useToolSessionStore
} from "@/lib/tools/tool-session-store";
import type { ToolSession } from "@/lib/tools/tool-session-types";
import { getPlanVersionOutput } from "@/lib/tools/tool-session-utils";

type SourceKind = "project" | "demo" | "trace-session";

interface RemixToolState extends RetainedStructureRemixParameters {
  sourceKind: SourceKind;
  sourceLabel: string;
  sourceVersion: PlanVersion;
  remixedVersion?: PlanVersion;
  previewMode: "before" | "after";
}

function relayoutableRoomCount(version: PlanVersion) {
  return version.rooms.filter((room) => !isRetainedStructureRoom(room)).length;
}

function createInitialParameters(version: PlanVersion): RetainedStructureRemixParameters {
  return defaultRemixParameters({ relayoutableRoomCount: relayoutableRoomCount(version) });
}

function demoVersion(typologyId: TypologyPackId) {
  return createDemoProjectData(typologyId).versions[0]!;
}

function countRelayoutedRooms(before: PlanVersion, after: PlanVersion, preservedRoomIds: Set<string>) {
  return after.rooms.filter((room) => {
    if (preservedRoomIds.has(room.id)) {
      return false;
    }

    const original = before.rooms.find((item) => item.id === room.id);
    return !original || JSON.stringify(original.polygon) !== JSON.stringify(room.polygon);
  }).length;
}

export function RetainedStructureRemixTool() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeVersion = useProjectState((state) => state.activeVersion);
  const projectId = useProjectState((state) => state.project.projectId);
  const { appendGeneratedVersions, setActiveVersion, setWorkflowPhase, setActiveTab } = useProjectActions();
  const { createSession, getSession, listRecentSessions, promoteSession, setActiveSessionId } = useToolSessionStore();

  const [sessionId, setSessionId] = useState<string | undefined>(searchParams.get("session") ?? undefined);
  const [state, setState] = useState<RemixToolState | undefined>();
  const [isRemixing, setIsRemixing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saveNotice, setSaveNotice] = useState<string | undefined>();
  const bootstrappedRef = useRef(false);

  const traceSessions = useMemo(
    () =>
      listRecentSessions(8).filter(
        (session) => session.toolId === "trace-to-cad" && session.status !== "promoted"
      ),
    [listRecentSessions]
  );

  const persistSession = useCallback(
    (next: RemixToolState) => {
      if (!sessionId) {
        return;
      }

      saveRetainedStructureRemixSession({
        sessionId,
        title: `${next.sourceLabel} · 保留结构重划`,
        sourceLabel: next.sourceLabel,
        sourceVersion: next.sourceVersion,
        remixedVersion: next.remixedVersion,
        parameters: {
          ...remixParametersToRecord(next),
          sourceKind: next.sourceKind
        }
      });
    },
    [sessionId]
  );

  const applyState = useCallback(
    (next: RemixToolState) => {
      setState(next);
      persistSession(next);
    },
    [persistSession]
  );

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    const requestedSessionId = searchParams.get("session");
    const existing = requestedSessionId ? getSession(requestedSessionId) : undefined;

    if (existing?.outputs?.length && getPlanVersionOutput(existing)) {
      setSessionId(existing.id);
      setActiveSessionId(existing.id);
      setState(restoredStateFromSession(existing));
      return;
    }

    const session = createSession("retained-structure-remix");
    setSessionId(session.id);
    setActiveSessionId(session.id);
    router.replace(`/tools/retained-structure-remix?session=${session.id}`);
  }, [createSession, getSession, router, searchParams, setActiveSessionId]);

  useEffect(() => {
    if (state || !sessionId) {
      return;
    }

    const initialVersion = activeVersion ?? demoVersion("healthcare");
    applyState({
      sourceKind: activeVersion ? "project" : "demo",
      sourceLabel: activeVersion?.label ?? "医疗示例方案",
      sourceVersion: initialVersion,
      previewMode: "before",
      ...createInitialParameters(initialVersion)
    });
  }, [activeVersion, applyState, sessionId, state]);

  const structureSummary = useMemo(
    () => (state ? summarizeRetainedStructure(state.sourceVersion) : undefined),
    [state]
  );

  const preservedRoomIds = useMemo(
    () => new Set(structureSummary?.preservedRooms.map((room) => room.id) ?? []),
    [structureSummary]
  );

  const previewVersion =
    state?.previewMode === "after" && state.remixedVersion ? state.remixedVersion : state?.sourceVersion;

  const handleLoadSource = useCallback(
    (kind: SourceKind, label: string, version: PlanVersion) => {
      if (!state) {
        return;
      }

      applyState({
        ...state,
        sourceKind: kind,
        sourceLabel: label,
        sourceVersion: version,
        remixedVersion: undefined,
        previewMode: "before",
        ...createInitialParameters(version)
      });
      setError(undefined);
    },
    [applyState, state]
  );

  const handleRemix = useCallback(async () => {
    if (!state) {
      return;
    }

    setIsRemixing(true);
    setError(undefined);

    try {
      const remixedVersion = await remixRetainedStructureViaApi({
        version: state.sourceVersion,
        outline: state.sourceVersion.outline,
        options: {
          targetFunctionalType: state.targetFunctionalType,
          targetRoomCount: state.targetRoomCount,
          publicAreaRatio: state.publicAreaRatio,
          corridorStrategy: state.corridorStrategy,
          layoutPriority: state.layoutPriority,
          allowSplitLargeRooms: state.allowSplitLargeRooms,
          lockExteriorWindows: state.lockExteriorWindows,
          preserveColumns: state.preserveColumns,
          preserveCores: state.preserveCores
        }
      });

      applyState({
        ...state,
        remixedVersion,
        previewMode: "after"
      });
    } catch (remixError) {
      setError(remixError instanceof Error ? remixError.message : "重划失败。");
    } finally {
      setIsRemixing(false);
    }
  }, [applyState, state]);

  const handleSaveResult = useCallback(() => {
    if (!state?.remixedVersion) {
      return;
    }

    persistSession(state);
    setSaveNotice("结果已保存到工具会话。");
    window.setTimeout(() => setSaveNotice(undefined), 2400);
  }, [persistSession, state]);

  const handleAddToProject = useCallback(() => {
    if (!state?.remixedVersion || !sessionId) {
      return;
    }

    appendGeneratedVersions([state.remixedVersion]);
    setActiveVersion(state.remixedVersion);
    setWorkflowPhase("scheme");
    setActiveTab("Plan");
    promoteSession(sessionId, projectId);
    router.push("/workspace");
  }, [
    appendGeneratedVersions,
    projectId,
    promoteSession,
    router,
    sessionId,
    setActiveTab,
    setActiveVersion,
    setWorkflowPhase,
    state
  ]);

  const handleExportSvg = useCallback(() => {
    const version = state?.remixedVersion ?? state?.sourceVersion;
    if (!version) {
      return;
    }

    downloadTextFile(`${version.id}-remix.svg`, createPlanSvg(version), "image/svg+xml");
  }, [state]);

  const handleExportJson = useCallback(() => {
    const version = state?.remixedVersion ?? state?.sourceVersion;
    if (!version) {
      return;
    }

    exportVersionJson(version);
  }, [state]);

  const relayoutedCount =
    state?.remixedVersion && state.sourceVersion
      ? countRelayoutedRooms(state.sourceVersion, state.remixedVersion, preservedRoomIds)
      : 0;

  return (
    <ToolPageShell
      toolName="保留结构重划"
      toolDescription="保留柱网与核心筒，重新划分可用空间"
      inputPanel={
        <div className="space-y-4 text-xs">
          {sessionId ? (
            <div className="rounded border border-line bg-panel/70 px-3 py-2 text-[11px] text-muted">
              会话 ID：<span className="text-slate-200">{sessionId}</span>
            </div>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">方案来源</h3>
            <button
              className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40 disabled:opacity-40"
              disabled={!activeVersion}
              type="button"
              onClick={() => activeVersion && handleLoadSource("project", activeVersion.label, activeVersion)}
            >
              <div className="text-slate-100">当前项目方案</div>
              <div className="mt-1 text-muted">{activeVersion?.label ?? "请先在 workspace 激活方案"}</div>
            </button>
            <button
              className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
              type="button"
              onClick={() => handleLoadSource("demo", "医疗示例方案", demoVersion("healthcare"))}
            >
              <div className="text-slate-100">医疗示例方案</div>
              <div className="mt-1 text-muted">含核心筒与竖向井道</div>
            </button>
            <button
              className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
              type="button"
              onClick={() => handleLoadSource("demo", "办公示例方案", demoVersion("office"))}
            >
              <div className="text-slate-100">办公示例方案</div>
              <div className="mt-1 text-muted">典型开放办公 + 侧核心</div>
            </button>
          </section>

          {traceSessions.length ? (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">扫描转 CAD 会话</h3>
              {traceSessions.map((session) => (
                <button
                  className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
                  key={session.id}
                  type="button"
                  onClick={() => {
                    const full = getSession(session.id);
                    if (!full) {
                      return;
                    }

                    const planOutput = getPlanVersionOutput(full);
                    const version = planOutput?.sourcePlanVersion ?? planOutput?.planVersion;
                    if (!version) {
                      return;
                    }

                    handleLoadSource("trace-session", full.title, version);
                  }}
                >
                  <div className="truncate text-slate-100">{session.title}</div>
                  <div className="mt-1 text-muted">恢复扫描识别结果</div>
                </button>
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">方案目标</h3>
            <label className="block rounded border border-line bg-panel/70 px-3 py-2">
              <span className="text-muted">目标功能类型</span>
              <select
                className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                value={state?.targetFunctionalType ?? "office"}
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    targetFunctionalType: event.target.value as RemixFunctionalType,
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              >
                {(Object.entries(REMIX_FUNCTIONAL_TYPE_LABELS) as [RemixFunctionalType, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
            <label className="block rounded border border-line bg-panel/70 px-3 py-2">
              <div className="flex items-center justify-between text-muted">
                <span>目标房间数量</span>
                <span className="text-slate-200">{state?.targetRoomCount ?? 6}</span>
              </div>
              <input
                className="mt-2 w-full accent-accent"
                max={24}
                min={3}
                step={1}
                type="range"
                value={state?.targetRoomCount ?? 6}
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    targetRoomCount: Number(event.target.value),
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              />
            </label>
            <label className="block rounded border border-line bg-panel/70 px-3 py-2">
              <div className="flex items-center justify-between text-muted">
                <span>公共区比例</span>
                <span className="text-slate-200">{Math.round((state?.publicAreaRatio ?? 0.25) * 100)}%</span>
              </div>
              <input
                className="mt-2 w-full accent-accent"
                max={45}
                min={8}
                step={1}
                type="range"
                value={Math.round((state?.publicAreaRatio ?? 0.25) * 100)}
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    publicAreaRatio: Number(event.target.value) / 100,
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              />
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">布局策略</h3>
            <label className="block rounded border border-line bg-panel/70 px-3 py-2">
              <span className="text-muted">走廊策略</span>
              <select
                className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                value={state?.corridorStrategy ?? "central"}
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    corridorStrategy: event.target.value as RemixCorridorStrategy,
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              >
                {(Object.entries(REMIX_CORRIDOR_STRATEGY_LABELS) as [RemixCorridorStrategy, string][]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
            <div className="space-y-1 rounded border border-line bg-panel/70 px-3 py-2">
              <span className="text-muted">优化优先</span>
              <div className="mt-2 grid grid-cols-1 gap-1">
                {(Object.entries(REMIX_LAYOUT_PRIORITY_LABELS) as [RemixLayoutPriority, string][]).map(
                  ([value, label]) => (
                    <label className="flex items-center gap-2" key={value}>
                      <input
                        checked={(state?.layoutPriority ?? "daylight") === value}
                        name="layoutPriority"
                        type="radio"
                        value={value}
                        onChange={() =>
                          state &&
                          applyState({
                            ...state,
                            layoutPriority: value,
                            remixedVersion: undefined,
                            previewMode: "before"
                          })
                        }
                      />
                      <span>{label}</span>
                    </label>
                  )
                )}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">高级选项</h3>
            <label className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3 py-2">
              <input
                checked={state?.allowSplitLargeRooms ?? true}
                type="checkbox"
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    allowSplitLargeRooms: event.target.checked,
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              />
              <span>允许拆分大房间</span>
            </label>
            <label className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3 py-2">
              <input
                checked={state?.lockExteriorWindows ?? false}
                type="checkbox"
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    lockExteriorWindows: event.target.checked,
                    remixedVersion: undefined,
                    previewMode: "before"
                  })
                }
              />
              <span>锁定外墙窗位</span>
            </label>
          </section>

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">保留约束</h3>
            <label className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3 py-2">
              <input
                checked={state?.preserveColumns ?? true}
                type="checkbox"
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    preserveColumns: event.target.checked
                  })
                }
              />
              <span>保留柱网</span>
            </label>
            <label className="flex items-center gap-2 rounded border border-line bg-panel/70 px-3 py-2">
              <input
                checked={state?.preserveCores ?? true}
                type="checkbox"
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    preserveCores: event.target.checked
                  })
                }
              />
              <span>保留核心筒 / 井道 / 设备间</span>
            </label>
          </section>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:border-accent/60 disabled:opacity-40"
            disabled={!state || isRemixing}
            type="button"
            onClick={() => void handleRemix()}
          >
            {isRemixing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            执行重划
          </button>

          {error ? <div className="rounded border border-danger/40 bg-danger/10 p-2 text-danger">{error}</div> : null}
        </div>
      }
      previewPanel={
        previewVersion ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                className={`rounded border px-3 py-1 text-xs ${
                  state?.previewMode === "before"
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line text-muted"
                }`}
                type="button"
                onClick={() => state && applyState({ ...state, previewMode: "before" })}
              >
                重划前
              </button>
              <button
                className={`rounded border px-3 py-1 text-xs ${
                  state?.previewMode === "after" && state.remixedVersion
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line text-muted"
                }`}
                disabled={!state?.remixedVersion}
                type="button"
                onClick={() => state?.remixedVersion && applyState({ ...state, previewMode: "after" })}
              >
                重划后
              </button>
            </div>
            <div className="overflow-hidden rounded border border-line bg-[#081018]">
              <FloorPlanCanvas className="h-[min(72vh,720px)] w-full" interactive={false} version={previewVersion} />
            </div>
          </div>
        ) : (
          <div className="grid h-full min-h-[280px] place-items-center rounded border border-dashed border-line bg-panel/40 p-8 text-center">
            <p className="text-sm text-muted">选择方案来源后，此处显示平面预览</p>
          </div>
        )
      }
      resultPanel={
        structureSummary && state ? (
          <div className="space-y-3 text-xs">
            <div className="rounded border border-line bg-panel/70 p-3">
              <div className="text-muted">当前来源</div>
              <div className="mt-1 font-medium text-slate-100">{state.sourceLabel}</div>
              <div className="mt-2 text-muted">{state.sourceVersion.rooms.length} 个房间</div>
            </div>
            <div className="rounded border border-line bg-panel/70 p-3">
              <div className="mb-2 flex items-center gap-2 text-muted">
                <Layers className="h-3.5 w-3.5" />
                保留结构
              </div>
              <ul className="space-y-1 text-slate-200">
                <li>{structureSummary.columnCount} 个柱网交点</li>
                <li>{structureSummary.preservedRooms.length} 个核心/井道房间</li>
                <li>{structureSummary.verticalElementCount} 个竖向约束元素</li>
              </ul>
            </div>
            {structureSummary.preservedRooms.length ? (
              <div className="rounded border border-line bg-panel/70 p-3">
                <div className="mb-2 text-muted">锁定房间</div>
                <ul className="space-y-1 text-slate-200">
                  {structureSummary.preservedRooms.map((room) => (
                    <li key={room.id}>
                      {room.name} · {room.type}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {state.remixedVersion ? (
              <div className="rounded border border-success/40 bg-success/10 p-3 text-success">
                已重划 {relayoutedCount} 个非结构房间 · {REMIX_FUNCTIONAL_TYPE_LABELS[state.targetFunctionalType]} ·{" "}
                {REMIX_CORRIDOR_STRATEGY_LABELS[state.corridorStrategy]} · 目标 {state.targetRoomCount} 间
              </div>
            ) : (
              <div className="rounded border border-line bg-panel/70 p-3 text-muted">
                点击「执行重划」后，程序房间将按拓扑重新排布，结构房间保持原位。
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border border-line bg-panel/70 p-3 text-xs text-muted">加载方案后显示结构摘要。</div>
        )
      }
      footerActions={
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!previewVersion}
                type="button"
                onClick={handleExportSvg}
              >
                <FileOutput className="h-3.5 w-3.5" />
                导出 SVG
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!previewVersion}
                type="button"
                onClick={handleExportJson}
              >
                <FileJson className="h-3.5 w-3.5" />
                导出 JSON
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!state?.remixedVersion}
                type="button"
                onClick={handleSaveResult}
              >
                <Save className="h-3.5 w-3.5" />
                保存结果
              </button>
            </div>
            {saveNotice ? <span className="text-[11px] text-success">{saveNotice}</span> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              disabled={!state?.remixedVersion}
              type="button"
              onClick={handleAddToProject}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              加入项目
            </button>
          </div>
        </>
      }
    />
  );
}

function restoredStateFromSession(session: ToolSession): RemixToolState | undefined {
  const planOutput = getPlanVersionOutput(session);
  if (!planOutput) {
    return undefined;
  }

  const sourceKind = (session.parameters?.sourceKind as SourceKind | undefined) ?? "demo";
  const sourceVersion = planOutput.sourcePlanVersion ?? planOutput.planVersion;
  const parameters = remixParametersFromRecord(session.parameters, createInitialParameters(sourceVersion));

  return {
    sourceKind,
    sourceLabel: session.inputFiles?.[0]?.fileName ?? session.title,
    sourceVersion,
    remixedVersion: planOutput.sourcePlanVersion ? planOutput.planVersion : undefined,
    previewMode: planOutput.sourcePlanVersion ? "after" : "before",
    ...parameters
  };
}
