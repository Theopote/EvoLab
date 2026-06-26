"use client";

import { useCallback, useMemo, useState } from "react";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { diffRoomIds } from "@/lib/design-decision-log";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import { useReviewSlice } from "@/lib/project-store";
import { useEvoProjectStore } from "@/lib/store/store";
import { attachTimelineEntryToLatestCopilotUndo } from "@/lib/store/history-slice";

export interface PreparedCopilotProposalInput {
  prompt: string;
  baseVersion: PlanVersion;
  proposal: PlanChangeProposal;
  findings?: CopilotFinding[];
  warning?: string;
  allowedRoomIds?: string[];
}

interface UseCopilotProposalRevisionOptions {
  activeVersion?: PlanVersion;
  onApplied?: (result: {
    prompt: string;
    parentVersion: PlanVersion;
    resultVersion: PlanVersion;
    changeSetId: string;
  }) => void;
}

export function useCopilotProposalRevision(options: UseCopilotProposalRevisionOptions = {}) {
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [pendingMeta, setPendingMeta] = useState<{ allowedRoomIds?: string[] }>({});

  const {
    lockedElementIds,
    copilotProposals,
    registerCopilotProposal,
    applyCopilotProposal,
    dismissCopilotProposal,
    recordDesignDecision
  } = useReviewSlice((state) => ({
    lockedElementIds: state.lockedElementIds,
    copilotProposals: state.copilotProposals,
    registerCopilotProposal: state.registerCopilotProposal,
    applyCopilotProposal: state.applyCopilotProposal,
    dismissCopilotProposal: state.dismissCopilotProposal,
    recordDesignDecision: state.recordDesignDecision
  }));

  const pendingProposal = useMemo(() => {
    if (!pendingProposalId) {
      return null;
    }

    const stored = copilotProposals.find((item) => item.id === pendingProposalId);

    if (!stored || stored.status !== "draft") {
      return null;
    }

    const baseVersion = stored.baseVersionSnapshot ?? options.activeVersion;

    if (!baseVersion) {
      return null;
    }

    return {
      ...stored,
      baseVersion,
      allowedRoomIds: pendingMeta.allowedRoomIds
    };
  }, [copilotProposals, options.activeVersion, pendingMeta.allowedRoomIds, pendingProposalId]);

  const prepareProposal = useCallback(
    (input: PreparedCopilotProposalInput) => {
      const stored = registerCopilotProposal({
        prompt: input.prompt,
        baseVersion: input.baseVersion,
        proposal: input.proposal,
        findings: input.findings ?? [],
        warning: input.warning
      });

      setPendingProposalId(stored.id);
      setPendingMeta({ allowedRoomIds: input.allowedRoomIds });

      return stored;
    },
    [registerCopilotProposal]
  );

  const applyPendingProposal = useCallback(
    (version: PlanVersion, acceptedOperationIds: string[]) => {
      if (!pendingProposalId) {
        return undefined;
      }

      const result = applyCopilotProposal(pendingProposalId, version, acceptedOperationIds);

      if (result) {
        const timelineEntry = useCopilotTimelineStore.getState().addEntry({
          prompt: result.prompt,
          parentVersionId: result.parentVersion.id,
          parentVersionLabel: result.parentVersion.label,
          resultVersionId: result.resultVersion.id,
          resultVersionLabel: result.resultVersion.label,
          changeSetId: result.changeSetId,
          proposalId: pendingProposalId
        });

        useEvoProjectStore.setState((state) => {
          attachTimelineEntryToLatestCopilotUndo(state, timelineEntry.id);
          return {};
        });

        recordDesignDecision({
          trigger: "ai_suggestion_accepted",
          description: pendingProposal?.proposal.intent ?? result.prompt,
          affectedRoomIds: diffRoomIds(result.parentVersion, result.resultVersion),
          versionIdBefore: result.parentVersion.id,
          versionIdAfter: result.resultVersion.id
        });
        options.onApplied?.(result);
      }

      setPendingProposalId(null);
      setPendingMeta({});

      return result;
    },
    [
      applyCopilotProposal,
      options,
      pendingProposal?.proposal.intent,
      pendingProposalId,
      recordDesignDecision
    ]
  );

  const dismissPendingProposal = useCallback(() => {
    if (pendingProposalId) {
      dismissCopilotProposal(pendingProposalId);
    }

    setPendingProposalId(null);
    setPendingMeta({});
  }, [dismissCopilotProposal, pendingProposalId]);

  return {
    lockedElementIds,
    copilotProposals,
    pendingProposal,
    pendingProposalId,
    prepareProposal,
    applyPendingProposal,
    dismissPendingProposal,
    selectPendingProposal: setPendingProposalId
  };
}
