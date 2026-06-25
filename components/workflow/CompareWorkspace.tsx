"use client";

import { GitCompareArrows, Pin } from "lucide-react";
import { CompareLensPanel } from "@/components/comparison/CompareLensPanel";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { ProposalReviewPanel } from "@/components/workflow/ProposalReviewPanel";
import type { ProjectDomain, ProgramModel, StoredCopilotProposal } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface CompareWorkspaceProps {
  versions: PlanVersion[];
  activeVersionId: string;
  compareVersionIds: string[];
  compareLevelId?: string;
  domain: ProjectDomain;
  program: ProgramModel;
  projectType: string;
  orientationDeg: number;
  copilotProposals: StoredCopilotProposal[];
  selectedProposalId?: string;
  lockedElementIds: string[];
  onCompareLevelChange: (levelId: string) => void;
  onSelectVersion: (version: PlanVersion) => void;
  onGenerateModel: (version: PlanVersion) => void;
  onRefineVersion: (version: PlanVersion) => void;
  onClose: () => void;
}

export function CompareWorkspace({
  versions,
  activeVersionId,
  compareVersionIds,
  compareLevelId,
  domain,
  program,
  projectType,
  orientationDeg,
  copilotProposals,
  selectedProposalId,
  lockedElementIds,
  onCompareLevelChange,
  onSelectVersion,
  onGenerateModel,
  onRefineVersion,
  onClose
}: CompareWorkspaceProps) {
  const selectedProposal = copilotProposals.find((item) => item.id === selectedProposalId);
  const proposalBaseVersion =
    selectedProposal?.baseVersionSnapshot ??
    versions.find((version) => version.id === selectedProposal?.baseVersionId);
  return (
    <section className="grid min-h-full grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded border border-line bg-panel/90 px-4 py-3">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <GitCompareArrows className="h-4 w-4 text-accent" />
            Compare workspace
          </h1>
          <p className="mt-1 text-xs text-muted">
            Pin up to three versions from the tree or cards below. Review metrics, side-by-side plans, hybrid options,
            and recommendations.
          </p>
        </div>
        <button
          className="h-8 rounded border border-line px-3 text-xs text-slate-200 hover:border-accent/50"
          type="button"
          onClick={onClose}
        >
          Exit compare
        </button>
      </header>

      {selectedProposal && proposalBaseVersion ? (
        <ProposalReviewPanel proposal={selectedProposal} baseVersion={proposalBaseVersion} lockedElementIds={lockedElementIds} />
      ) : null}

      {compareVersionIds.length < 2 ? (
        <div className="flex items-start gap-3 rounded border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
          <Pin className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Pin at least two versions to enable lens comparison, geometry diff, and recommendations. You can still use
            the grid below to compare all generated schemes.
          </p>
        </div>
      ) : (
        <CompareLensPanel
          versions={versions}
          compareVersionIds={compareVersionIds}
          compareLevelId={compareLevelId}
          domain={domain}
          program={program}
          projectType={projectType}
          onCompareLevelChange={onCompareLevelChange}
          onSelectVersion={onSelectVersion}
        />
      )}

      <VersionCompareGrid
        versions={versions}
        activeVersionId={activeVersionId}
        compareLevelId={compareLevelId}
        domain={domain}
        program={program}
        projectType={projectType}
        orientationDeg={orientationDeg}
        onCompareLevelChange={onCompareLevelChange}
        onSelectVersion={onSelectVersion}
        onGenerateModel={onGenerateModel}
        onRefineVersion={onRefineVersion}
      />
    </section>
  );
}
