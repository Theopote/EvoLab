"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileJson, FileOutput, Loader2, PlusCircle, Save } from "lucide-react";
import { ImportWizard, type ImportWizardResult } from "@/components/workflow/import/ImportWizard";
import { TraceReviewEditor } from "@/components/tools/TraceReviewEditor";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import type { AnalyzePlanClientResult } from "@/lib/plan-import/analyze-plan-client";
import { createPlanSvg, downloadTextFile, exportDxfDocument, exportVersionJson } from "@/lib/export-utils";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";
import type { PlanImportSource } from "@/lib/plan-import/types";
import { saveTraceToCadSession, useToolSessionStore } from "@/lib/tools/tool-session-store";
import type { ToolSession } from "@/lib/tools/tool-session-types";
import { useInteractionStore } from "@/lib/interaction-store";
import { useImportSessionStore } from "@/lib/import-session-store";

interface TraceReviewState {
  draftVersion: PlanVersion;
  recognizedVersion: PlanVersion;
  analysis: AnalyzePlanClientResult;
  fileName: string;
  sourceType: PlanImportSource;
  referencePreviewUrl?: string;
}

export function TraceToCadTool() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useProjectState((state) => state.project.projectId);
  const { appendGeneratedVersions, setActiveVersion, setWorkflowPhase, setActiveTab } = useProjectActions();
  const { createSession, getSession, promoteSession, setActiveSessionId } = useToolSessionStore();
  const [sessionId, setSessionId] = useState<string | undefined>(searchParams.get("session") ?? undefined);
  const [reviewState, setReviewState] = useState<TraceReviewState | undefined>();
  const [dxfExportPending, setDxfExportPending] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | undefined>();
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }

    bootstrappedRef.current = true;
    const requestedSessionId = searchParams.get("session");
    const existing = requestedSessionId ? getSession(requestedSessionId) : undefined;

    if (existing?.outputs?.planVersion && existing.analysisMeta) {
      setSessionId(existing.id);
      setActiveSessionId(existing.id);
      setReviewState(reviewStateFromSession(existing));
      return;
    }

    const session = createSession("trace-to-cad");
    setSessionId(session.id);
    setActiveSessionId(session.id);
    router.replace(`/tools/trace-to-cad?session=${session.id}`);
  }, [createSession, getSession, router, searchParams, setActiveSessionId]);

  const persistSession = useCallback(
    (state: TraceReviewState) => {
      if (!sessionId) {
        return;
      }

      saveTraceToCadSession({
        sessionId,
        title: `${state.fileName} · 扫描转 CAD`,
        inputFiles: [{ fileName: state.fileName, sourceType: state.sourceType }],
        outputs: {
          kind: "plan-version",
          planVersion: state.draftVersion,
          referencePreviewUrl: state.referencePreviewUrl
        },
        analysisMeta: {
          confidence: state.analysis.confidence,
          importPath: state.analysis.importPath,
          sourceType: state.analysis.sourceType,
          warnings: state.analysis.warnings,
          fallback: state.analysis.fallback
        }
      });
    },
    [sessionId]
  );

  const handleReviewStateChange = useCallback(
    (state: TraceReviewState | undefined) => {
      setReviewState(state);
      if (state) {
        persistSession(state);
      }
    },
    [persistSession]
  );

  const handleDraftVersionChange = useCallback(
    (draftVersion: PlanVersion) => {
      setReviewState((current) => {
        if (!current) {
          return current;
        }

        const next = { ...current, draftVersion };
        persistSession(next);
        return next;
      });
    },
    [persistSession]
  );

  const handleSaveResult = useCallback(() => {
    if (!reviewState) {
      return;
    }

    persistSession(reviewState);
    setSaveNotice("结果已保存到工具会话，可在首页继续。");
    window.setTimeout(() => setSaveNotice(undefined), 2400);
  }, [persistSession, reviewState]);

  const handleAddToProject = useCallback(
    (openTrace: boolean) => {
      if (!reviewState || !sessionId) {
        return;
      }

      const enrichedVersion = {
        ...reviewState.draftVersion,
        metadata: {
          ...reviewState.draftVersion.metadata,
          importSource: {
            fileName: reviewState.fileName,
            sourceType: reviewState.analysis.sourceType,
            importPath: reviewState.analysis.importPath,
            confidence: reviewState.analysis.confidence,
            warnings: reviewState.analysis.warnings
          }
        }
      };

      appendGeneratedVersions([enrichedVersion]);
      setActiveVersion(enrichedVersion);

      const previewUrl = reviewState.referencePreviewUrl;
      if (previewUrl) {
        useImportSessionStore.getState().setReference({
          versionId: enrichedVersion.id,
          fileName: reviewState.fileName,
          sourceType: reviewState.analysis.sourceType,
          previewUrl,
          opacity: reviewState.sourceType === "image" ? 0.45 : 0.35
        });
      }

      if (openTrace) {
        useInteractionStore.getState().setActiveTool("trace");
      } else {
        useInteractionStore.getState().setActiveTool("select");
      }

      setWorkflowPhase("scheme");
      setActiveTab("Plan");
      promoteSession(sessionId, projectId);
      router.push("/workspace");
    },
    [
      appendGeneratedVersions,
      projectId,
      promoteSession,
      reviewState,
      router,
      sessionId,
      setActiveTab,
      setActiveVersion,
      setWorkflowPhase
    ]
  );

  const handleExportSvg = useCallback(() => {
    if (!reviewState?.draftVersion) {
      return;
    }

    downloadTextFile(
      `${reviewState.draftVersion.id}.svg`,
      createPlanSvg(reviewState.draftVersion),
      "image/svg+xml"
    );
  }, [reviewState]);

  const handleExportJson = useCallback(() => {
    if (!reviewState?.draftVersion) {
      return;
    }

    exportVersionJson(reviewState.draftVersion);
  }, [reviewState]);

  const handleExportDxf = useCallback(() => {
    if (!reviewState?.draftVersion) {
      return;
    }

    setDxfExportPending(true);
    try {
      exportDxfDocument(reviewState.draftVersion);
    } finally {
      window.setTimeout(() => setDxfExportPending(false), 400);
    }
  }, [reviewState]);

  const hasResult = Boolean(reviewState?.draftVersion);

  return (
    <ToolPageShell
      toolName="扫描图转 CAD"
      toolDescription="上传图片、PDF 或 DXF，识别为可编辑 PlanVersion"
      inputPanel={
        <div className="space-y-3">
          {sessionId ? (
            <div className="rounded border border-line bg-panel/70 px-3 py-2 text-[11px] text-muted">
              会话 ID：<span className="text-slate-200">{sessionId}</span>
            </div>
          ) : null}
          <TraceToCadInput
            onImportComplete={() => {
              /* handled via review state in embedded mode */
            }}
            onReviewStateChange={handleReviewStateChange}
          />
        </div>
      }
      previewPanel={
        hasResult && reviewState ? (
          <TraceReviewEditor
            draftVersion={reviewState.draftVersion}
            fileName={reviewState.fileName}
            recognizedVersion={reviewState.recognizedVersion}
            referencePreviewUrl={reviewState.referencePreviewUrl}
            sourceType={reviewState.sourceType}
            onDraftVersionChange={handleDraftVersionChange}
          />
        ) : (
          <div className="grid h-full min-h-[280px] place-items-center rounded border border-dashed border-line bg-panel/40 p-8 text-center">
            <p className="text-sm text-muted">上传并识别后，此处显示平面预览与追踪叠加</p>
          </div>
        )
      }
      resultPanel={
        hasResult && reviewState ? (
          <TraceResultPanel analysis={reviewState.analysis} version={reviewState.draftVersion} />
        ) : (
          <div className="rounded border border-line bg-panel/70 p-3 text-xs leading-5 text-muted">
            识别完成后，置信度、导入路径与警告将显示在此。
          </div>
        )
      }
      footerActions={
        <>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!hasResult}
                type="button"
                onClick={handleExportSvg}
              >
                <FileOutput className="h-3.5 w-3.5" />
                导出 SVG
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!hasResult}
                type="button"
                onClick={handleExportJson}
              >
                <FileJson className="h-3.5 w-3.5" />
                导出 JSON
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-muted transition hover:border-accent/50 hover:text-slate-100 disabled:opacity-40"
                disabled={!hasResult || dxfExportPending}
                title="导出 DXF"
                type="button"
                onClick={handleExportDxf}
              >
                {dxfExportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileOutput className="h-3.5 w-3.5" />}
                导出 DXF
              </button>
              <button
                className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
                disabled={!hasResult}
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
              className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 disabled:opacity-40"
              disabled={!hasResult}
              type="button"
              onClick={() => handleAddToProject(false)}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              加入项目
            </button>
            <button
              className="inline-flex items-center gap-1.5 rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
              disabled={!hasResult}
              type="button"
              onClick={() => handleAddToProject(true)}
            >
              加入项目并打开追踪
            </button>
          </div>
        </>
      }
    />
  );
}

function reviewStateFromSession(session: ToolSession): TraceReviewState | undefined {
  if (!session.outputs?.planVersion || !session.analysisMeta) {
    return undefined;
  }

  const sourceType = session.analysisMeta.sourceType as PlanImportSource;
  const analysis: AnalyzePlanClientResult = {
    version: session.outputs.planVersion,
    confidence: session.analysisMeta.confidence,
    importPath: session.analysisMeta.importPath,
    sourceType,
    warnings: session.analysisMeta.warnings,
    fallback: session.analysisMeta.fallback
  };

  return {
    draftVersion: session.outputs.planVersion,
    recognizedVersion: session.outputs.planVersion,
    analysis,
    fileName: session.inputFiles?.[0]?.fileName ?? "restored-drawing",
    sourceType,
    referencePreviewUrl: session.outputs.referencePreviewUrl
  };
}

function TraceToCadInput({
  onImportComplete,
  onReviewStateChange
}: {
  onImportComplete: (result: ImportWizardResult) => void;
  onReviewStateChange: (state: TraceReviewState | undefined) => void;
}) {
  return (
    <ImportWizard
      embedded
      onContinueToTrace={() => {
        /* standalone tool — trace opens in workspace after add */
      }}
      onImportComplete={onImportComplete}
      onReviewStateChange={(state) => {
        if (!state.draftVersion || !state.analysis || !state.file) {
          onReviewStateChange(undefined);
          return;
        }

        onReviewStateChange({
          draftVersion: state.draftVersion,
          recognizedVersion: state.recognizedVersion ?? state.draftVersion,
          analysis: state.analysis,
          fileName: state.file.fileName,
          sourceType: state.analysis.sourceType,
          referencePreviewUrl: state.referencePreviewUrl
        });
      }}
    />
  );
}

function TraceResultPanel({ analysis, version }: { analysis: AnalyzePlanClientResult; version: PlanVersion }) {
  const confidencePct = Math.round(analysis.confidence * 100);

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded border border-line bg-panel/70 p-3">
        <div className="text-muted">置信度</div>
        <div className="mt-1 text-lg font-semibold text-accent">{confidencePct}%</div>
      </div>
      <div className="rounded border border-line bg-panel/70 p-3">
        <div className="text-muted">导入路径</div>
        <div className="mt-1 text-slate-100">{analysis.importPath === "vision" ? "视觉识别" : "结构化解析"}</div>
        <div className="mt-1 text-muted">来源：{analysis.sourceType.toUpperCase()}</div>
      </div>
      <div className="rounded border border-line bg-panel/70 p-3">
        <div className="text-muted">识别结果</div>
        <ul className="mt-2 space-y-1 text-slate-200">
          <li>{version.rooms.length} 个房间</li>
          <li>{version.levels[0]?.walls.length ?? 0} 段墙体</li>
          <li>{version.levels[0]?.openings.length ?? 0} 个门窗</li>
        </ul>
      </div>
      {analysis.fallback ? (
        <div className="rounded border border-warning/40 bg-warning/10 p-3 text-warning">
          已使用 Mock 降级结果（未配置 API Key 或识别失败）
        </div>
      ) : null}
      {analysis.warnings.length > 0 ? (
        <div className="rounded border border-line bg-panel/70 p-3">
          <div className="mb-2 text-muted">警告</div>
          <ul className="space-y-1 text-warning">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
