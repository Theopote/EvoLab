import { produce } from "immer";
import { normalizePlanVersion } from "@/lib/architecture-model";
import {
  addCopilotProposalComment as addCopilotProposalCommentInDomain,
  appendCopilotProposal,
  createStoredCopilotProposal,
  dismissCopilotProposal as dismissCopilotProposalInDomain,
  markCopilotProposalApplied,
  resolveProposalOperationSets,
  revertCopilotProposalAfterUndo
} from "@/lib/copilot-proposals";
import {
  appendChangeSet,
  approveChangeSetInDomain,
  createChangeSet,
  rejectChangeSetInDomain
} from "@/lib/project-domain";
import {
  buildCopilotInsightsFromEngines,
  enqueueInsights,
  markInsightsReviewed
} from "@/lib/copilot-insight-queue";
import { appendDesignDecision, createDesignDecision } from "@/lib/design-decision-log";
import {
  bumpGeometryRevision,
  clearSelectionDraft,
  getActiveVersion,
  refreshDerivedDraft
} from "@/lib/store/draft-helpers";
import { pushCopilotUndoEntry } from "@/lib/store/history-slice";
import type { EvoProjectStore } from "@/lib/store/types";
import type { ReviewSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createReviewSlice: StateCreator<EvoProjectStore, [], [], ReviewSliceActions> = (set, get) => ({
  selectCopilotProposal: (proposalId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectedProposalId = proposalId;
      })
    ),
  registerCopilotProposal: (input) => {
    const stored = createStoredCopilotProposal(input);

    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = appendCopilotProposal(state.project.domain, stored);
      })
    );

    return stored;
  },
  applyCopilotProposal: (proposalId, version, acceptedOperationIds) => {
    const state = get();
    const stored = state.project.domain.copilotProposals.find((item) => item.id === proposalId);

    if (!stored || stored.status !== "draft") {
      return undefined;
    }

    const parentVersion =
      stored.baseVersionSnapshot ??
      state.project.versions.find((item) => item.id === stored.baseVersionId);

    if (!parentVersion) {
      return undefined;
    }

    const normalized = normalizePlanVersion(version);
    const operationSets = resolveProposalOperationSets(
      stored.proposal,
      acceptedOperationIds,
      state.project.domain.lockedElementIds,
      parentVersion
    );
    const changeSet = createChangeSet({
      source: "ai",
      summary: stored.proposal.intent,
      baseVersion: parentVersion,
      targetVersion: normalized,
      proposalId,
      acceptedOperationIds: operationSets.acceptedOperationIds
    });

    set(
      produce<EvoProjectStore>((draft) => {
        draft.project.versions = [...draft.project.versions, normalized];
        draft.project.activeVersionId = normalized.id;
        draft.project.domain = appendChangeSet(draft.project.domain, changeSet);
        draft.project.domain = markCopilotProposalApplied(draft.project.domain, proposalId, {
          resultVersionId: normalized.id,
          changeSetId: changeSet.id,
          ...operationSets
        });
        pushCopilotUndoEntry(draft, {
          changeSetId: changeSet.id,
          proposalId
        });
        bumpGeometryRevision(draft);
        refreshDerivedDraft(draft);
      })
    );

    return {
      prompt: stored.prompt,
      parentVersion,
      resultVersion: normalized,
      changeSetId: changeSet.id
    };
  },
  dismissCopilotProposal: (proposalId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = dismissCopilotProposalInDomain(state.project.domain, proposalId);
      })
    ),
  addCopilotProposalComment: (proposalId, text) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = addCopilotProposalCommentInDomain(state.project.domain, proposalId, text);
      })
    ),
  refreshCopilotInsights: () =>
    set(
      produce<EvoProjectStore>((state) => {
        const version = getActiveVersion(state.project);

        if (!version) {
          return;
        }

        const fresh = buildCopilotInsightsFromEngines(version, state.project.domain, state.project.projectType);
        state.project.domain.copilotInsightQueue = enqueueInsights(state.project.domain.copilotInsightQueue, fresh);
      })
    ),
  reviewCopilotInsights: () =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.project.domain.copilotInsightQueue) {
          return;
        }

        state.project.domain.copilotInsightQueue = markInsightsReviewed(state.project.domain.copilotInsightQueue);
      })
    ),
  recordDesignDecision: (input) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain.designDecisions = appendDesignDecision(
          state.project.domain.designDecisions,
          createDesignDecision(input)
        );
      })
    ),
  selectChangeSet: (changeSetId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectedChangeSetId = changeSetId;
      })
    ),
  approveChangeSet: (changeSetId, lockChangedElements = true) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project.domain = approveChangeSetInDomain(state.project.domain, changeSetId, {
          lockChangedElements
        });
      })
    ),
  rejectChangeSet: (changeSetId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const changeSet = state.project.domain.changeSets.find((item) => item.id === changeSetId);
        const result = rejectChangeSetInDomain(state.project.domain, changeSetId, state.project.versions);
        state.project.domain = result.domain;
        state.project.versions = result.versions;
        state.project.activeVersionId = result.activeVersionId;

        if (changeSet?.proposalId) {
          state.project.domain = revertCopilotProposalAfterUndo(state.project.domain, changeSet.proposalId);
        }

        state.undoStack = state.undoStack.filter(
          (entry) => !(entry.kind === "copilot" && entry.changeSetId === changeSetId)
        );

        clearSelectionDraft(state);
        bumpGeometryRevision(state);
        refreshDerivedDraft(state);
      })
    )
});
