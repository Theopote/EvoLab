"use client";

import { Check, Loader2, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import type { DesignBrief, PlanVersion, Point } from "@/lib/project-types";
import type { ZoningConstraints } from "@/lib/site-types";

interface PlanResultGridProps {
  outline: Point[];
  closed: boolean;
  brief: DesignBrief;
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
  zoning,
  versions,
  activeVersionId,
  onGenerated,
  onSelectVersion
}: PlanResultGridProps) {
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

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Plan Options</h2>
          <p className="mt-1 text-xs text-muted">Generate three editable candidates from outline and brief.</p>
        </div>
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

      {error ? <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{error}</div> : null}
      {notice ? <div className="mb-3 rounded border border-warning/40 bg-warning/10 p-2 text-xs text-warning">{notice}</div> : null}

      <div className="grid gap-3 xl:grid-cols-3">
        {versions.map((version) => (
          <article
            className={`rounded border bg-[#0b1118] p-3 ${
              version.id === activeVersionId ? "border-accent/70" : "border-line"
            }`}
            key={version.id}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-white">{version.label}</h3>
                <p className="mt-1 text-xs text-muted">{version.rooms.length} rooms</p>
              </div>
              {version.id === activeVersionId ? (
                <span className="rounded border border-accent/40 px-2 py-1 text-[11px] text-accent">Active</span>
              ) : null}
            </div>
            <FloorPlan
              version={version}
              className="mb-3 [&>div]:min-h-[180px] [&_svg]:min-h-[180px]"
              interactive={false}
            />
            <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Area" value={version.scores?.areaEfficiency} />
              <Metric label="Flow" value={version.scores?.circulationScore} />
              <Metric label="Daylight" value={version.scores?.daylightScore} />
              <Metric label="MEP" value={version.scores?.mepAlignmentScore} />
            </div>
            <div className="mb-3 text-xs text-warning">Risks: {version.scores?.riskCount ?? 0}</div>
            <button
              className="flex h-8 w-full items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
              type="button"
              onClick={() => onSelectVersion(version)}
            >
              <Check className="h-3.5 w-3.5" />
              Set Active
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-2">
      <div className="text-muted">{label}</div>
      <div className="mt-1 text-sm text-white">{value ?? 0}</div>
    </div>
  );
}
