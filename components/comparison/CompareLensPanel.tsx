"use client";

import { Download, FileText, Loader2, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { DiagramCanvas } from "@/components/diagrams/DiagramCanvas";
import { CompareOverlayPlan } from "@/components/comparison/CompareOverlayPlan";
import { CompareRecommendationBar } from "@/components/comparison/CompareRecommendationBar";
import { SchemeGeometryDiff } from "@/components/comparison/SchemeGeometryDiff";
import { FloorPlan } from "@/components/floor-plan";
import { MepCanvas } from "@/components/mep/MepCanvas";
import { SimpleTooltip } from "@/components/ui/Tooltip";
import { buildCompareReport } from "@/lib/compare/build-compare-report";
import { compareLensDefinitions, analysisLayersForCompareLens, mepLayersForCompareLens, usesAnalysisEngine } from "@/lib/compare/lens-config";
import { downloadCompareReportPdfViaApi } from "@/lib/compare/export-compare-client";
import { roomsForCompareLevel, summarizeRoomChangesAtLevel } from "@/lib/compare/geometry-diff";
import { downloadCompareReportHtml } from "@/lib/compare/render-compare-html";
import type { CompareLensId } from "@/lib/compare/types";
import { listComparableLevels } from "@/lib/multi-floor";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { ProjectDomain, ProgramModel } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface CompareLensPanelProps {
  projectName: string;
  activeVersionId: string;
  versions: PlanVersion[];
  compareVersionIds: string[];
  compareLevelId?: string;
  domain: ProjectDomain;
  program: ProgramModel;
  projectType: string;
  onCompareLevelChange?: (levelId: string) => void;
  onSelectVersion: (version: PlanVersion) => void;
}

export function CompareLensPanel({
  projectName,
  activeVersionId,
  versions,
  compareVersionIds,
  compareLevelId,
  domain,
  program,
  projectType,
  onCompareLevelChange,
  onSelectVersion
}: CompareLensPanelProps) {
  const [lens, setLens] = useState<CompareLensId>("plan");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const compared = compareVersionIds
    .map((id) => versions.find((version) => version.id === id))
    .filter((version): version is PlanVersion => Boolean(version))
    .slice(0, 3);

  const levelOptions = listComparableLevels(compared.length ? compared : versions);
  const resolvedLevelId = compareLevelId ?? levelOptions[0]?.id;
  const activeLens = lens === "diff" && compared.length < 2 ? "plan" : lens;
  const lensDefinition = compareLensDefinitions.find((item) => item.id === activeLens);

  const diffPair = compared.length >= 2 ? [compared[0]!, compared[1]!] : undefined;
  const diffSummary = useMemo(() => {
    if (!diffPair) {
      return undefined;
    }

    return summarizeRoomChangesAtLevel(diffPair[0], diffPair[1], resolvedLevelId);
  }, [diffPair, resolvedLevelId]);

  const diffVersions = useMemo(() => {
    if (!diffPair) {
      return undefined;
    }

    return {
      base: {
        ...diffPair[0],
        rooms: roomsForCompareLevel(diffPair[0], resolvedLevelId)
      },
      preview: {
        ...diffPair[1],
        rooms: roomsForCompareLevel(diffPair[1], resolvedLevelId)
      }
    };
  }, [diffPair, resolvedLevelId]);

  const compareReportInput = useMemo(
    () => ({
      projectName,
      projectType,
      domain,
      program,
      activeVersionId,
      versions,
      compareVersionIds,
      compareLevelId: resolvedLevelId
    }),
    [
      activeVersionId,
      compareVersionIds,
      domain,
      program,
      projectName,
      projectType,
      resolvedLevelId,
      versions
    ]
  );

  function buildReport() {
    return buildCompareReport(compareReportInput);
  }

  function exportHtmlReport() {
    setExportNotice(null);
    const report = buildReport();

    if (!report) {
      setExportNotice("Pin at least two schemes to export a compare report.");
      return;
    }

    downloadCompareReportHtml(report);
    setExportNotice("Compare report HTML downloaded.");
  }

  async function exportPdfReport() {
    setExportNotice(null);
    const report = buildReport();

    if (!report) {
      setExportNotice("Pin at least two schemes to export a compare report.");
      return;
    }

    setIsExportingPdf(true);

    try {
      await downloadCompareReportPdfViaApi(report);
      setExportNotice("Compare report PDF downloaded via server export API.");
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : "Compare PDF export failed.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  if (compared.length < 2) {
    return null;
  }

  return (
    <section className="space-y-3 rounded border border-line bg-panel/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">固定版本对比</h2>
            <SimpleTooltip title="使用不同镜头对比已固定的方案版本">
              <Info className="h-3.5 w-3.5 text-muted" />
            </SimpleTooltip>
          </div>
          <p className="mt-1 text-xs text-muted">
            {lensDefinition?.description ?? "切换镜头以查看平面、指标、叠加图和几何差异"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {levelOptions.length > 1 ? (
            <SimpleTooltip title="选择要对比的楼层">
              <select
                className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100 hover:border-accent/50"
                value={resolvedLevelId}
                onChange={(event) => onCompareLevelChange?.(event.target.value)}
              >
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </SimpleTooltip>
          ) : null}
          <SimpleTooltip title="导出HTML格式的对比报告（可在浏览器中打开）">
            <button
              className="flex h-8 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50 hover:bg-panel/30 transition-colors"
              type="button"
              onClick={exportHtmlReport}
            >
              <Download className="h-3.5 w-3.5" />
              导出HTML
            </button>
          </SimpleTooltip>
          <SimpleTooltip title="导出PDF格式的对比报告（通过服务器处理，适合打印和分享）">
            <button
              className="flex h-8 items-center gap-2 rounded border border-line px-3 text-xs text-slate-100 hover:border-accent/50 hover:bg-panel/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isExportingPdf}
              onClick={() => void exportPdfReport()}
            >
              {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              导出PDF
            </button>
          </SimpleTooltip>
          <div className="flex flex-wrap gap-1 rounded border border-line p-0.5">
            {compareLensDefinitions.map((item) => {
              const disabled = item.requiresPair && compared.length < 2;

              return (
                <SimpleTooltip
                  key={item.id}
                  title={item.description}
                  disabled={disabled}
                >
                  <button
                    className={`rounded px-2 py-1 text-[11px] transition-colors ${
                      activeLens === item.id
                      ? "bg-accent/15 text-accent"
                      : disabled
                        ? "cursor-not-allowed text-muted/40"
                        : "text-muted hover:bg-white/[0.04] hover:text-slate-100"
                  }`}
                    disabled={disabled}
                    type="button"
                    onClick={() => setLens(item.id)}
                  >
                    {item.label}
                  </button>
                </SimpleTooltip>
              );
            })}
          </div>
        </div>
      </div>

      {exportNotice ? <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{exportNotice}</div> : null}

      {diffPair ? (
        <CompareRecommendationBar
          left={diffPair[0]}
          right={diffPair[1]}
          domain={domain}
          program={program}
          projectType={projectType}
          onAcceptRecommendation={onSelectVersion}
        />
      ) : null}

      {activeLens === "diff" && diffVersions && diffSummary ? (
        <article className="rounded border border-line bg-[#0b1118] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-slate-100">Geometry diff</h3>
            <span className="text-xs text-muted">
              {diffVersions.base.label} → {diffVersions.preview.label}
            </span>
          </div>
          <SchemeGeometryDiff
            baseVersion={diffVersions.base}
            previewVersion={diffVersions.preview}
            changes={diffSummary}
            heightClassName="h-56"
          />
        </article>
      ) : (
        <div className={`grid gap-3 ${compared.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
          {compared.map((version) => (
            <CompareLensVersionCard
              domain={domain}
              key={version.id}
              lens={activeLens}
              levelId={resolvedLevelId}
              projectType={projectType}
              version={version}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CompareLensVersionCard({
  version,
  levelId,
  lens,
  projectType,
  domain
}: {
  version: PlanVersion;
  levelId?: string;
  lens: CompareLensId;
  projectType: string;
  domain: ProjectDomain;
}) {
  const quantities = calculateQuantities(version, { levelId, scope: "level" });

  return (
    <article className="rounded border border-line bg-[#0b1118] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="truncate text-sm font-medium text-slate-100">{version.label}</h3>
        <span className="text-xs text-muted">{quantities.summary.grossArea} sqm</span>
      </div>

      {lens === "plan" ? (
        <FloorPlan
          version={version}
          levelId={levelId}
          className="[&>div]:min-h-[220px] [&_svg]:min-h-[220px]"
          interactive={false}
        />
      ) : null}

      {usesAnalysisEngine(lens) ? (
        <DiagramCanvas
          compact
          activeLayers={analysisLayersForCompareLens(lens)}
          version={version}
          levelId={levelId}
          projectType={projectType}
        />
      ) : null}

      {lens === "structure" ? (
        <CompareOverlayPlan
          version={version}
          levelId={levelId}
          lens="structure"
          structuralSystem={domain.structuralSystem}
        />
      ) : null}

      {lens === "furniture" ? (
        <CompareOverlayPlan
          version={version}
          levelId={levelId}
          lens="furniture"
          furnitureLayout={domain.furnitureLayout}
        />
      ) : null}

      {lens === "systems" ? (
        <MepCanvas compact activeLayers={mepLayersForCompareLens()} version={version} activeLevelId={levelId} />
      ) : null}
    </article>
  );
}
