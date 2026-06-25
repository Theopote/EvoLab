"use client";

import { Check, Sparkles } from "lucide-react";
import { VersionCompareExplainPanel } from "@/components/score/VersionCompareExplainPanel";
import type { ProgramModel, ProjectDomain } from "@/lib/building-domain";
import { getProgramGoals } from "@/lib/project-domain";
import type { PlanVersion } from "@/lib/project-types";
import { computeTotalScore } from "@/lib/rules/version-total-score";

interface CompareRecommendationBarProps {
  left: PlanVersion;
  right: PlanVersion;
  domain: ProjectDomain;
  program: ProgramModel;
  projectType: string;
  onAcceptRecommendation: (version: PlanVersion) => void;
}

const emptyScores = {
  areaEfficiency: 0,
  circulationScore: 0,
  daylightScore: 0,
  mepAlignmentScore: 0,
  riskCount: 0
};

export function CompareRecommendationBar({
  left,
  right,
  domain,
  program,
  projectType,
  onAcceptRecommendation
}: CompareRecommendationBarProps) {
  const programGoals = getProgramGoals(domain);
  const leftTotal = computeTotalScore(left.scores ?? emptyScores, programGoals);
  const rightTotal = computeTotalScore(right.scores ?? emptyScores, programGoals);
  const recommended = leftTotal >= rightTotal ? left : right;

  return (
    <section className="rounded border border-success/30 bg-success/5 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles className="h-4 w-4 text-success" />
          Decision recommendation
        </div>
        <button
          className="flex h-8 items-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014]"
          type="button"
          onClick={() => onAcceptRecommendation(recommended)}
        >
          <Check className="h-3.5 w-3.5" />
          Set active: {recommended.label}
        </button>
      </div>

      <VersionCompareExplainPanel
        left={left}
        right={right}
        program={program}
        projectType={projectType}
        programGoals={programGoals}
      />
    </section>
  );
}
