"use client";

import { useCallback, useState } from "react";
import type { ScoringConfig } from "@/lib/building-domain";
import {
  buildComplianceFixPackageById,
  isComplianceFixAction,
  requestComplianceFixPreview,
  type ComplianceFixPreview
} from "@/lib/compliance-fix";
import type { CopilotAction, CopilotFinding, PlanVersion } from "@/lib/project-types";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";

export interface ComplianceFixProposalReadyInput {
  prompt: string;
  proposal: PlanChangeProposal;
  findings: CopilotFinding[];
  warning?: string;
  highlightRoomIds: string[];
}

interface UseComplianceFixActionOptions {
  activeVersion?: PlanVersion;
  projectType: string;
  scoringConfig?: ScoringConfig;
  onBeforeFix?: () => void;
  onProposalReady: (input: ComplianceFixProposalReadyInput) => void;
  onNotice?: (message: string) => void;
}

export function useComplianceFixAction({
  activeVersion,
  projectType,
  scoringConfig,
  onBeforeFix,
  onProposalReady,
  onNotice
}: UseComplianceFixActionOptions) {
  const [isComplianceFixing, setIsComplianceFixing] = useState(false);

  const runComplianceFixAction = useCallback(
    async (violationId: string) => {
      if (!activeVersion || isComplianceFixing) {
        return;
      }

      const fixPackage = buildComplianceFixPackageById(activeVersion, violationId, {
        buildingType: projectType,
        scoringConfig
      });

      if (!fixPackage) {
        onNotice?.("This compliance issue cannot be auto-fixed yet. Try a manual inpaint edit on the affected floor.");
        return;
      }

      setIsComplianceFixing(true);
      onBeforeFix?.();

      try {
        const preview = await requestComplianceFixPreview(activeVersion, fixPackage, {
          buildingType: projectType,
          scoringConfig
        });
        publishCompliancePreview(preview, onProposalReady);
        onNotice?.(
          preview.fallback
            ? `Prepared a compliance fix proposal for ${fixPackage.floorName} (fallback). Review each operation before applying.`
            : `Prepared a compliance fix proposal for ${fixPackage.floorName}. Review each operation before applying.`
        );
      } catch (error) {
        onNotice?.(error instanceof Error ? error.message : "Compliance fix request failed.");
      } finally {
        setIsComplianceFixing(false);
      }
    },
    [activeVersion, isComplianceFixing, onBeforeFix, onNotice, onProposalReady, projectType, scoringConfig]
  );

  const handleComplianceAction = useCallback(
    (action: CopilotAction) => {
      if (!isComplianceFixAction(action) || !action.payload) {
        return false;
      }

      void runComplianceFixAction(action.payload);
      return true;
    },
    [runComplianceFixAction]
  );

  return {
    isComplianceFixing,
    runComplianceFixAction,
    handleComplianceAction
  };
}

function publishCompliancePreview(
  preview: ComplianceFixPreview,
  onProposalReady: (input: ComplianceFixProposalReadyInput) => void
) {
  const findings: CopilotFinding[] = [
    {
      id: `finding-compliance-${preview.fixPackage.ruleId}`,
      tone: preview.fallback ? "warning" : "success",
      text: preview.fallback
        ? "Compliance fix used an inpaint fallback proposal."
        : "Compliance fix mapped to deterministic geometry operations.",
      sub: preview.warning
    }
  ];

  onProposalReady({
    prompt: preview.prompt,
    proposal: preview.proposal,
    findings,
    warning: preview.warning,
    highlightRoomIds: preview.highlightRoomIds
  });
}
