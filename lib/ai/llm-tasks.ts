export type LlmTask =
  | "generate-plan-topology"
  | "generate-plan-geometry"
  | "generate-plan-refine"
  | "copilot-modify"
  | "copilot-inpaint"
  | "hybridize-schemes"
  | "generate-mep"
  | "analyze-plan"
  | "diagram"
  | "intake"
  | "sketch"
  | "reshape-boundary"
  | "report-edit"
  | "default";

export type LlmTier = "light" | "standard" | "heavy";

export const TASK_TIER: Record<LlmTask, LlmTier> = {
  "generate-plan-topology": "heavy",
  "generate-plan-geometry": "heavy",
  "generate-plan-refine": "heavy",
  "copilot-modify": "standard",
  "copilot-inpaint": "standard",
  "hybridize-schemes": "heavy",
  "generate-mep": "heavy",
  "analyze-plan": "light",
  "diagram": "standard",
  "intake": "light",
  "sketch": "light",
  "reshape-boundary": "light",
  "report-edit": "standard",
  default: "standard"
};
