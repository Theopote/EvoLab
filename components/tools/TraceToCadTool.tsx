"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileJson, FileOutput, Loader2, PlusCircle } from "lucide-react";
import { ImportWizard, type ImportWizardResult } from "@/components/workflow/import/ImportWizard";
import { ToolPageShell } from "@/components/tools/ToolPageShell";
import type { AnalyzePlanClientResult } from "@/lib/plan-import/analyze-plan-client";
import { createPlanSvg, downloadTextFile, exportVersionJson } from "@/lib/export-utils";
import { useProjectActions } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";
import type { CopilotPinnedFile } from "@/lib/copilot-upload";

interface TraceReviewState {
  draftVersion: PlanVersion;
  analysis: AnalyzePlanClientResult;
  file: CopilotPinnedFile;
  referencePreviewUrl?: string;
}

export function TraceToCadTool() {
  const router = useRouter();
  const { appendGeneratedVersions, setActiveVersion, setWorkflowPhase, setActiveTab } = useProjectActions();
  const [reviewState, setReviewState] = useState<TraceReviewState | undefined>();
  const [dxfExportPending, setDxfExportPending] = useState(false);

  const handleReviewStateChange = useCallback((state: TraceReviewState | undefined) => {
    setReviewState(state);
  }, []);

  const handleAddToProject = useCallback(
    (openTrace: boolean) => {
      if (!reviewState) {
        return;
      }

      const enrichedVersion = {
        ...reviewState.draftVersion,
        metadata: {
          ...reviewState.draftVersion.metadata,
          importSource: {
            fileName: reviewState.file.fileName,
            sourceType: reviewState.analysis.sourceType,
            importPath: reviewState.analysis.importPath,
            confidence: reviewState.analysis.confidence,
            warnings: reviewState.analysis.warnings
          }
        }
      };

      appendGeneratedVersions([enrichedVersion]);
      setActiveVersion(enrichedVersion);
      setWorkflowPhase("scheme");
      setActiveTab("Plan");
      router.push(openTrace ? "/workspace" : "/workspace");
    },
    [appendGeneratedVersions, reviewState, router, setActiveTab, setActiveVersion, setWorkflowPhase]
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
    setDxfExportPending(true);
    window.setTimeout(() => setDxfExportPending(false), 1200);
  }, []);

  const hasResult = Boolean(reviewState?.draftVersion);

  return (
    <ToolPageShell
      toolName="扫描图转 CAD"
      toolDescription="上传图片、PDF 或 DXF，识别为可编辑 PlanVersion"
      inputPanel={
        <TraceToCadInput
          onImportComplete={() => {
            /* handled via review state in embedded mode */
          }}
          onReviewStateChange={handleReviewStateChange}
        />
      }
      previewPanel={
        hasResult && reviewState ? (
          <PlanSvgPreview version={reviewState.draftVersion} />
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
              title="DXF 导出接口预留"
              type="button"
              onClick={handleExportDxf}
            >
              {dxfExportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileOutput className="h-3.5 w-3.5" />}
              导出 DXF（即将推出）
            </button>
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
          analysis: state.analysis,
          file: state.file,
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

function PlanSvgPreview({ version }: { version: PlanVersion }) {
  const svgMarkup = useMemo(() => createPlanSvg(version), [version]);

  return (
    <div
      className="cad-grid flex min-h-[320px] h-full items-center justify-center overflow-auto rounded border border-line bg-[#081018] p-4 [&>svg]:max-h-full [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}
