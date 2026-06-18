import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

export interface ModifyPlanResponse {
  mode: "proposal";
  proposal: PlanChangeProposal;
  version: PlanVersion;
  findings: CopilotFinding[];
  fallback?: boolean;
  warning?: string;
}

export interface PendingCopilotProposalView {
  id: string;
  prompt: string;
  baseVersion: PlanVersion;
  proposal: PlanChangeProposal;
  findings: CopilotFinding[];
  warning?: string;
}
