"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FileText, Loader2, PlusCircle, Presentation, Save, Sparkles } from "lucide-react";
import { PresentationSlidePreview } from "@/components/tools/PresentationSlidePreview";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import { generateStoryboardViaApi } from "@/lib/presentation/generate-storyboard-client";
import {
  defaultStoryArcFromDeck,
  presentationSourceFromDemo,
  presentationSourceFromProject,
  presentationSourceFromToolSession,
  type PresentationGeneratorSource,
  type PresentationGeneratorSourceKind,
  createPresentationProjectFromVersion
} from "@/lib/presentation/presentation-generator-source";
import { downloadPresentationHtml } from "@/lib/presentation/render-html";
import { downloadPresentationPptxViaApi, prepareDeckForPptx } from "@/lib/presentation/render-pptx-client";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { presentationTemplates } from "@/lib/presentation/templates";
import type { PresentationDeck, PresentationTemplateId } from "@/lib/presentation/types";
import { usePresentationActions, useProjectActions, useProjectState } from "@/lib/project-store";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import {
  savePresentationGeneratorSession,
  useRecentToolSessions,
  useToolSessionActions
} from "@/lib/tools/tool-session-store";
import type { ToolSession } from "@/lib/tools/tool-session-types";
import { getPlanVersionOutput, getPresentationDeckOutput } from "@/lib/tools/tool-session-utils";

interface GeneratorToolState {
  sourceKind: PresentationGeneratorSourceKind;
  sourceLabel: string;
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  compareVersionIds?: string[];
  sourceSessionId?: string;
  templateId: PresentationTemplateId;
  deck?: PresentationDeck;
  activeSlideIndex: number;
  aiEnhanced: boolean;
}

export function PresentationGeneratorTool() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const project = useProjectState((state) => state.project);
  const activeVersion = useProjectState((state) => state.activeVersion);
  const brief = useProjectState((state) => state.brief);
  const compareVersionIds = useProjectState((state) => state.compareVersionIds);
  const projectId = useProjectState((state) => state.project.projectId);
  const { appendGeneratedVersions, setActiveVersion, setWorkflowPhase, setActiveTab } = useProjectActions();
  const { savePresentationSession } = usePresentationActions();
  const { createSession, getSession, promoteSession, setActiveSessionId } = useToolSessionActions();
  const recentSessions = useRecentToolSessions(10);

  const [sessionId, setSessionId] = useState<string | undefined>(searchParams.get("session") ?? undefined);
  const [state, setState] = useState<GeneratorToolState | undefined>();
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isEnhancingAi, setIsEnhancingAi] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [saveNotice, setSaveNotice] = useState<string | undefined>();
  const bootstrappedRef = useRef(false);

  const planSessions = useMemo(
    () =>
      recentSessions.filter(
        (session) =>
          (session.toolId === "trace-to-cad" || session.toolId === "retained-structure-remix") &&
          session.status !== "promoted"
      ),
    [recentSessions]
  );

  const persistSession = useCallback(
    (next: GeneratorToolState) => {
      if (!sessionId || !next.deck) {
        return;
      }

      savePresentationGeneratorSession({
        sessionId,
        title: `${next.sourceLabel} · 汇报生成`,
        sourceLabel: next.sourceLabel,
        deck: next.deck,
        planVersion: next.version,
        parameters: {
          sourceKind: next.sourceKind,
          templateId: next.templateId,
          aiEnhanced: next.aiEnhanced,
          sourceSessionId: next.sourceSessionId ?? ""
        }
      });
    },
    [sessionId]
  );

  const applyState = useCallback(
    (next: GeneratorToolState) => {
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

    if (existing?.outputs?.length) {
      const restored = restoredStateFromSession(existing);
      if (restored) {
        setSessionId(existing.id);
        setActiveSessionId(existing.id);
        setState(restored);
        return;
      }
    }

    const session = createSession("presentation-generator");
    setSessionId(session.id);
    setActiveSessionId(session.id);
    router.replace(`/tools/presentation-generator?session=${session.id}`);
  }, [createSession, getSession, router, searchParams, setActiveSessionId]);

  useEffect(() => {
    if (state || !sessionId) {
      return;
    }

    const initialSource = activeVersion
      ? presentationSourceFromProject({
          project,
          version: activeVersion,
          brief,
          compareVersionIds
        })
      : presentationSourceFromDemo("healthcare");

    setState(createInitialState(initialSource));
  }, [activeVersion, brief, compareVersionIds, project, sessionId, state]);

  const activeSlide = state?.deck?.slides[state.activeSlideIndex];

  const handleLoadSource = useCallback(
    (source: PresentationGeneratorSource) => {
      applyState({
        ...createInitialState(source),
        templateId: state?.templateId ?? "classic"
      });
      setError(undefined);
    },
    [applyState, state?.templateId]
  );

  const buildDeckInput = useCallback(() => {
    if (!state) {
      return undefined;
    }

    return {
      project: state.project,
      version: state.version,
      brief: state.brief ?? brief,
      compareVersionIds: state.compareVersionIds
    };
  }, [brief, state]);

  const handleGenerateOutline = useCallback(async () => {
    const input = buildDeckInput();
    if (!state || !input) {
      return;
    }

    setIsGeneratingOutline(true);
    setError(undefined);

    try {
      const deck = buildPresentationDeck(input);
      const withArc: PresentationDeck = {
        ...deck,
        templateId: state.templateId,
        storyArc: defaultStoryArcFromDeck(deck.slides)
      };

      applyState({
        ...state,
        deck: withArc,
        activeSlideIndex: 0,
        aiEnhanced: false
      });
    } catch (outlineError) {
      setError(outlineError instanceof Error ? outlineError.message : "生成大纲失败。");
    } finally {
      setIsGeneratingOutline(false);
    }
  }, [applyState, buildDeckInput, state]);

  const handleEnhanceWithAi = useCallback(async () => {
    const input = buildDeckInput();
    if (!state || !input) {
      return;
    }

    setIsEnhancingAi(true);
    setError(undefined);

    try {
      const result = await generateStoryboardViaApi(input);
      applyState({
        ...state,
        deck: {
          ...result.deck,
          templateId: state.templateId
        },
        activeSlideIndex: 0,
        aiEnhanced: !result.fallback
      });

      if (result.warning) {
        setError(result.warning);
      }
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "AI 叙事生成失败，可先使用基础大纲。");
    } finally {
      setIsEnhancingAi(false);
    }
  }, [applyState, buildDeckInput, state]);

  const handleSaveResult = useCallback(() => {
    if (!state?.deck) {
      return;
    }

    persistSession(state);
    setSaveNotice("汇报已保存到工具会话。");
    window.setTimeout(() => setSaveNotice(undefined), 2400);
  }, [persistSession, state]);

  const handleExportPptx = useCallback(async () => {
    if (!state?.deck) {
      return;
    }

    setIsExportingPptx(true);
    setError(undefined);

    try {
      const prepared = await prepareDeckForPptx(state.deck);
      await downloadPresentationPptxViaApi(prepared);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "PPTX 导出失败。");
    } finally {
      setIsExportingPptx(false);
    }
  }, [state?.deck]);

  const handleExportHtml = useCallback(() => {
    if (!state?.deck) {
      return;
    }

    downloadPresentationHtml(state.deck);
  }, [state?.deck]);

  const handleOpenInWorkspace = useCallback(() => {
    if (!state?.deck || !sessionId) {
      return;
    }

    appendGeneratedVersions([state.version]);
    setActiveVersion(state.version);
    savePresentationSession(state.version.id, { deck: state.deck, templateId: state.templateId });
    setWorkflowPhase("deliver");
    setActiveTab("Presentation");
    promoteSession(sessionId, projectId);
    persistSession(state);
    router.push("/workspace");
  }, [
    appendGeneratedVersions,
    persistSession,
    projectId,
    promoteSession,
    router,
    savePresentationSession,
    sessionId,
    setActiveTab,
    setActiveVersion,
    setWorkflowPhase,
    state
  ]);

  return (
    <ToolPageShell
      toolName="汇报生成"
      toolDescription="从项目或工具结果生成汇报大纲与 PPTX"
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
              onClick={() =>
                activeVersion &&
                handleLoadSource(
                  presentationSourceFromProject({
                    project,
                    version: activeVersion,
                    brief,
                    compareVersionIds
                  })
                )
              }
            >
              <div className="text-slate-100">当前项目方案</div>
              <div className="mt-1 text-muted">{activeVersion?.label ?? "请先在 workspace 激活方案"}</div>
            </button>
            <button
              className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
              type="button"
              onClick={() => handleLoadSource(presentationSourceFromDemo("healthcare"))}
            >
              <div className="text-slate-100">医疗示例方案</div>
              <div className="mt-1 text-muted">含完整指标与拓扑</div>
            </button>
            <button
              className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
              type="button"
              onClick={() => handleLoadSource(presentationSourceFromDemo("office"))}
            >
              <div className="text-slate-100">办公示例方案</div>
              <div className="mt-1 text-muted">典型开放办公示例</div>
            </button>
          </section>

          {planSessions.length ? (
            <section className="space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">工具结果</h3>
              {planSessions.map((sessionSummary) => (
                <button
                  className="w-full rounded border border-line bg-panel/70 px-3 py-2 text-left hover:border-accent/40"
                  key={sessionSummary.id}
                  type="button"
                  onClick={() => {
                    const full = getSession(sessionSummary.id);
                    if (!full) {
                      return;
                    }

                    const source = presentationSourceFromToolSession(full);
                    if (source) {
                      handleLoadSource(source);
                    }
                  }}
                >
                  <div className="truncate text-slate-100">{sessionSummary.title}</div>
                  <div className="mt-1 text-muted">从工具会话导入方案</div>
                </button>
              ))}
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">汇报设置</h3>
            <label className="block rounded border border-line bg-panel/70 px-3 py-2">
              <span className="text-muted">模板风格</span>
              <select
                className="mt-1 w-full rounded border border-line bg-canvas px-2 py-1.5 text-slate-100"
                value={state?.templateId ?? "classic"}
                onChange={(event) =>
                  state &&
                  applyState({
                    ...state,
                    templateId: event.target.value as PresentationTemplateId,
                    deck: state.deck ? { ...state.deck, templateId: event.target.value as PresentationTemplateId } : undefined
                  })
                }
              >
                {Object.values(presentationTemplates).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-line bg-panel/70 px-3 py-2 text-xs hover:border-accent/40 disabled:opacity-40"
            disabled={!state || isGeneratingOutline}
            type="button"
            onClick={() => void handleGenerateOutline()}
          >
            {isGeneratingOutline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            生成汇报大纲
          </button>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:border-accent/60 disabled:opacity-40"
            disabled={!state || isEnhancingAi}
            type="button"
            onClick={() => void handleEnhanceWithAi()}
          >
            {isEnhancingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI 润色叙事
          </button>

          {error ? <div className="rounded border border-danger/40 bg-danger/10 p-2 text-danger">{error}</div> : null}
        </div>
      }
      previewPanel={
        state?.deck && activeSlide ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {state.deck.slides.map((slide, index) => (
                <button
                  className={`rounded border px-2.5 py-1 text-[11px] ${
                    index === state.activeSlideIndex
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line text-muted hover:text-slate-100"
                  }`}
                  key={slide.id}
                  type="button"
                  onClick={() => applyState({ ...state, activeSlideIndex: index })}
                >
                  {index + 1}. {slide.title.split(" ")[0]}
                </button>
              ))}
            </div>
            <PresentationSlidePreview className="min-h-0 flex-1 overflow-auto" slide={activeSlide} />
          </div>
        ) : (
          <div className="grid h-full min-h-[280px] place-items-center rounded border border-dashed border-line bg-panel/40 p-8 text-center">
            <Presentation className="mx-auto mb-3 h-8 w-8 text-muted" />
            <p className="text-sm text-muted">选择方案来源后，点击「生成汇报大纲」预览幻灯片</p>
          </div>
        )
      }
      resultPanel={
        state ? (
          <div className="space-y-3 text-xs">
            <div className="rounded border border-line bg-panel/70 p-3">
              <div className="text-muted">当前来源</div>
              <div className="mt-1 font-medium text-slate-100">{state.sourceLabel}</div>
              <div className="mt-2 text-muted">{state.version.rooms.length} 个房间 · {state.version.label}</div>
            </div>

            {state.deck ? (
              <>
                <div className="rounded border border-success/40 bg-success/10 p-3 text-success">
                  已生成 {state.deck.slides.length} 页汇报
                  {state.aiEnhanced ? " · AI 叙事已润色" : " · 基础大纲"}
                </div>
                <div className="rounded border border-line bg-panel/70 p-3">
                  <div className="mb-2 text-muted">故事线</div>
                  <p className="text-slate-200">
                    {(state.deck.storyArc ?? defaultStoryArcFromDeck(state.deck.slides)).join(" → ")}
                  </p>
                </div>
                <div className="rounded border border-line bg-panel/70 p-3">
                  <div className="mb-2 text-muted">幻灯片目录</div>
                  <ol className="max-h-48 space-y-1 overflow-auto text-slate-200">
                    {state.deck.slides.map((slide, index) => (
                      <li key={slide.id}>
                        <button
                          className="text-left hover:text-accent"
                          type="button"
                          onClick={() => applyState({ ...state, activeSlideIndex: index })}
                        >
                          {index + 1}. {slide.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <div className="rounded border border-line bg-panel/70 p-3 text-muted">
                生成大纲后可导出 PPTX，或加入项目在工作台继续编辑。
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border border-line bg-panel/70 p-3 text-muted">加载方案后显示摘要。</div>
        )
      }
      footerActions={
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!state?.deck || isExportingPptx}
                type="button"
                onClick={() => void handleExportPptx()}
              >
                {isExportingPptx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                导出 PPTX
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!state?.deck}
                type="button"
                onClick={handleExportHtml}
              >
                <FileText className="h-3.5 w-3.5" />
                导出 HTML
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!state?.deck}
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
              disabled={!state?.deck}
              type="button"
              onClick={handleOpenInWorkspace}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              加入项目并编辑
            </button>
          </div>
        </>
      }
    />
  );
}

function createInitialState(source: PresentationGeneratorSource): GeneratorToolState {
  return {
    sourceKind: source.kind,
    sourceLabel: source.label,
    project: source.project,
    version: source.version,
    brief: source.brief,
    compareVersionIds: source.compareVersionIds,
    sourceSessionId: source.sourceSessionId,
    templateId: "classic",
    activeSlideIndex: 0,
    aiEnhanced: false
  };
}

function restoredStateFromSession(session: ToolSession): GeneratorToolState | undefined {
  const deckOutput = getPresentationDeckOutput(session);
  const planOutput = getPlanVersionOutput(session);
  const version = planOutput?.planVersion;

  if (!deckOutput?.deck.slides.length || !version) {
    return undefined;
  }

  const sourceKind = (session.parameters?.sourceKind as PresentationGeneratorSourceKind | undefined) ?? "tool-session";
  const templateId = (session.parameters?.templateId as PresentationTemplateId | undefined) ?? "classic";

  return {
    sourceKind,
    sourceLabel: session.inputFiles?.[0]?.fileName ?? session.title,
    project: createPresentationProjectFromVersion({
      projectName: deckOutput.deck.projectName,
      projectType: deckOutput.deck.projectType,
      version,
      versions: planOutput?.sourcePlanVersion ? [planOutput.sourcePlanVersion, version] : [version]
    }),
    version,
    compareVersionIds: planOutput?.sourcePlanVersion ? [planOutput.sourcePlanVersion.id, version.id] : undefined,
    sourceSessionId: typeof session.parameters?.sourceSessionId === "string" ? session.parameters.sourceSessionId : undefined,
    templateId,
    deck: { ...deckOutput.deck, templateId },
    activeSlideIndex: 0,
    aiEnhanced: session.parameters?.aiEnhanced === true
  };
}
