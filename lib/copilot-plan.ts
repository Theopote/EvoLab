import type { CopilotAction } from "@/lib/project-types";

export interface CopilotPlanStep {
  description: string;
  action: CopilotAction;
}

export interface CopilotPlan {
  steps: CopilotPlanStep[];
  requiresConfirmation: boolean;
}

const COMPOUND_PATTERNS: Array<{ pattern: RegExp; steps: CopilotPlanStep[] }> = [
  {
    pattern: /open.?office|开放式办公/i,
    steps: [
      { description: "Adjust room program for open office layout", action: { id: "switch-tab", label: "Plan", payload: "Plan" } },
      { description: "Generate MEP routing for revised layout", action: { id: "switch-tab", label: "Systems", payload: "Systems" } },
      { description: "Refresh quantity takeoff", action: { id: "switch-tab", label: "Quantity", payload: "Quantity" } }
    ]
  },
  {
    pattern: /(系统图|diagram).*(算量|quantity|report)|quantity.*diagram/i,
    steps: [
      { description: "Generate systems diagram", action: { id: "generate-flow-diagram", label: "Analysis" } },
      { description: "Open quantity summary", action: { id: "switch-tab", label: "Quantity", payload: "Quantity" } }
    ]
  },
  {
    pattern: /regenerate|重新生成.*方案/i,
    steps: [{ description: "Regenerate plan options from brief", action: { id: "regenerate-plan", label: "Regenerate" } }]
  }
];

export function detectCopilotPlan(userRequest: string): CopilotPlan | null {
  const text = userRequest.trim();

  if (!text) {
    return null;
  }

  const clauseCount = text.split(/[,，;；然后|并且|and then|then]/i).filter((part) => part.trim().length > 3).length;

  for (const candidate of COMPOUND_PATTERNS) {
    if (candidate.pattern.test(text)) {
      return {
        steps: candidate.steps,
        requiresConfirmation: candidate.steps.length > 1
      };
    }
  }

  if (clauseCount >= 2 && /(生成|导出|算量|系统|report|export|generate)/i.test(text)) {
    return {
      steps: [
        { description: "Apply requested plan changes", action: { id: "switch-tab", label: "Plan", payload: "Plan" } },
        { description: "Refresh dependent analysis outputs", action: { id: "switch-tab", label: "Analysis", payload: "Analysis" } },
        { description: "Update quantity / export artifacts", action: { id: "switch-tab", label: "Export", payload: "Export" } }
      ],
      requiresConfirmation: true
    };
  }

  return null;
}
