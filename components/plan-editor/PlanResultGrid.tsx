"use client";

import { Check, GitCompare, GitCompareArrows, Loader2, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { getProgramGoals } from "@/lib/project-domain";
import type { DesignBrief, PlanVersion, Point } from "@/lib/project-types";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import type { ProgramModel } from "@/lib/building-domain";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import type { ZoningConstraints } from "@/lib/site-types";
import { tabForSchemeSubview } from "@/lib/workflow-phases";

interface PlanResultGridProps {
  outline: Point[];
  closed: boolean;
  brief: DesignBrief;
  program: ProgramModel;
  zoning?: ZoningConstraints;
  versions: PlanVersion[];
  activeVersionId: string;
  onGenerated: (versions: PlanVersion[]) => void;
  onSelectVersion: (version: PlanVersion) => void;
}

export function PlanResultGrid({
  outline,
  closed,
  brief,
  program,
  zoning,
  versions,
  activeVersionId,
  onGenerated,
  onSelectVersion
}: PlanResultGridProps) {
  const { project, compareVersionIds } = useProjectState((state) => ({
    project: state.project,
    compareVersionIds: state.compareVersionIds
  }));
  const { toggleCompareVersion, setActiveTab, setWorkflowPhase } = useProjectActions();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function generatePlans() {
    setIsGenerating(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outline,
          projectType: brief.projectType,
          floors: brief.floors,
          zoning,
          designBrief: brief,
          program,
          brief: [
            brief.description,
            `${brief.floors} floors`,
            `${brief.targetArea} sqm`,
            `core: ${brief.corePreference}`,
            `orientation: ${brief.orientationPreference}`
          ].join("\n")
        })
      });

      if (!response.ok) {
        throw new Error(`Generate plan failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        versions?: PlanVersion[];
        pipeline?: { warnings?: string[]; envelopeApplied?: boolean };
        warning?: string;
        fallback?: boolean;
      };

      if (!data.versions?.length) {
        throw new Error("No plan versions returned.");
      }

      const pipelineWarnings = data.pipeline?.warnings?.filter(Boolean) ?? [];
      const responseWarning = data.warning ? [data.warning] : [];
      const combinedNotice = [...pipelineWarnings, ...responseWarning].join(" ");

      if (combinedNotice) {
        setNotice(combinedNotice);
      }

      onGenerated(data.versions);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to generate plans.");
    } finally {
      setIsGenerating(false);
    }
  }

  function openCompareWorkspace() {
    setWorkflowPhase("scheme");
    setActiveTab(tabForSchemeSubview("compare"));
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Plan Options</h2>
          <p className="mt-1 text-xs text-muted">
            Generate candidates, pin up to three for compare, or set one active to edit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compareVersionIds.length >= 2 ? (
            <button
              className="flex h-9 items-center gap-2 rounded border border-accent/40 bg-accent/10 px-3 text-xs text-accent hover:border-accent/60"
              type="button"
              onClick={openCompareWorkspace}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Open compare ({compareVersionIds.length})
            </button>
          ) : null}
          <button
          className="flex h-9 items-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={generatePlans}
          disabled={!closed || outline.length < 3 || isGenerating}
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          Generate
        </button>
        </div>
      </div>

      {error ? <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{error}</div> : null}
      {notice ? <div className="mb-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{notice}</div> : null}

      <div className="grid gap-3 xl:grid-cols-3">
        {versions.map((version) => {
          const isCompared = compareVersionIds.includes(version.id);
          const totalScore = computeTotalScore(
            version.scores ?? {
              areaEfficiency: 0,
              circulationScore: 0,
              daylightScore: 0,
              mepAlignmentScore: 0,
              riskCount: 0
            },
            getProgramGoals(project.domain)
          );

          return (
          <article
            className={`rounded border bg-[#0b1118] p-3 ${
              version.id === activeVersionId
                ? "border-accent/70"
                : isCompared
                  ? "border-warning/50"
                  : "border-line"
            }`}
            key={version.id}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-white">{version.label}</h3>
                <p className="mt-1 text-xs text-muted">
                  {version.rooms.length} rooms · score {totalScore}
                  {(version.scores?.riskCount ?? 0) > 0 ? ` · ${version.scores?.riskCount} risks` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {version.id === activeVersionId ? (
                  <span className="rounded border border-accent/40 px-2 py-1 text-[11px] text-accent">Active</span>
                ) : null}
                {isCompared ? (
                  <span className="rounded border border-warning/40 px-2 py-1 text-[11px] text-warning">Pinned</span>
                ) : null}
              </div>
            </div>
            <FloorPlan
              version={version}
              className="mb-3 [&>div]:min-h-[180px] [&_svg]:min-h-[180px]"
              interactive={false}
            />
            {version.scores?.breakdown?.comparisonHints[0] ? (
              <p className="mb-3 line-clamp-2 text-[11px] leading-4 text-muted">
                {version.scores.breakdown.comparisonHints[0]}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                type="button"
                onClick={() => onSelectVersion(version)}
              >
                <Check className="h-3.5 w-3.5" />
                Set Active
              </button>
              <button
                className={`flex h-8 items-center justify-center gap-2 rounded border text-xs ${
                  isCompared
                    ? "border-warning/60 text-warning"
                    : "border-line text-slate-100 hover:border-accent/60 hover:text-accent"
                }`}
                type="button"
                onClick={() => toggleCompareVersion(version.id)}
              >
                <GitCompare className="h-3.5 w-3.5" />
                {isCompared ? "Unpin" : "Pin"}
              </button>
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}
