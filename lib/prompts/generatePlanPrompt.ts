import { buildGenerateGeometrySystemPrompt } from "@/lib/prompts/generateGeometryPrompt";
import { buildGenerateTopologySystemPrompt } from "@/lib/prompts/generateTopologyPrompt";

/**
 * @deprecated Monolithic prompt split into generateTopologyPrompt + generateGeometryPrompt.
 * Kept for backwards compatibility with docs and external references.
 */
export const generatePlanPrompt = [
  buildGenerateTopologySystemPrompt(),
  "---",
  buildGenerateGeometrySystemPrompt()
].join("\n\n");
