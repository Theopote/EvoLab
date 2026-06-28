"use client";

import { GitCompareArrows, Pin, Info } from "lucide-react";
import { CompareLensPanel } from "@/components/comparison/CompareLensPanel";
import { VersionCompareGrid } from "@/components/version-compare/VersionCompareGrid";
import { ProposalReviewPanel } from "@/components/workflow/ProposalReviewPanel";
import { SimpleTooltip } from "@/components/ui/Tooltip";
import type { ProjectDomain, ProgramModel, StoredCopilotProposal } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface CompareWorkspaceProps {
  projectName: string;
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
  projectName,
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
            方案对比工作区
            <SimpleTooltip title="对比多个方案的平面、指标和混合选项，最多可同时对比3个版本">
              <Info className="h-3.5 w-3.5 text-muted" />
            </SimpleTooltip>
          </h1>
          <p className="mt-1 text-xs text-muted">
            从版本树或下方卡片中固定最多3个版本，对比指标、平面布局、混合选项和优化建议
          </p>
        </div>
        <SimpleTooltip title="退出对比模式，返回正常编辑视图">
          <button
            className="h-8 rounded border border-line px-3 text-xs text-slate-200 hover:border-accent/50 hover:bg-panel/30"
            type="button"
            onClick={onClose}
          >
            退出对比
          </button>
        </SimpleTooltip>
      </header>

      {selectedProposal && proposalBaseVersion ? (
        <ProposalReviewPanel proposal={selectedProposal} baseVersion={proposalBaseVersion} lockedElementIds={lockedElementIds} />
      ) : null}

      {compareVersionIds.length < 2 ? (
        <div className="flex items-start gap-3 rounded border border-blue-500/30 bg-blue-500/5 p-4 text-sm">
          <Pin className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div>
            <p className="font-medium text-blue-200">需要固定至少2个版本</p>
            <p className="mt-1 text-xs text-blue-300/80">
              在版本树中点击图钉图标或在下方卡片中选择版本进行对比。固定2-3个版本后，您可以使用镜头对比、几何差异分析、优化建议和导出报告等功能。
            </p>
          </div>
        </div>
      ) : (
        <CompareLensPanel
          projectName={projectName}
          activeVersionId={activeVersionId}
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
