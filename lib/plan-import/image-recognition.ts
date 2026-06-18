import { requestAnthropicTool } from "@/lib/anthropic-tool";
import type { NormalizedImageInput } from "@/lib/image-input";
import { analyzePlanVisionPrompt } from "@/lib/prompts/analyzePlanVisionPrompt";
import { buildPlanVersionFromGraph, estimateGraphConfidence } from "@/lib/plan-import/graph-to-version";
import type { PlanImportResult } from "@/lib/plan-import/types";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { AnalyzePlanVisionToolInputSchema } from "@/lib/schemas/recognized-plan-graph-schema";

export async function importPlanFromImage(
  image: NormalizedImageInput,
  fileName?: string
): Promise<PlanImportResult> {
  const vision = await requestAnthropicTool({
    system: analyzePlanVisionPrompt,
    input: {
      fileName,
      image: {
        mediaType: image.mediaType,
        byteLength: image.byteLength
      },
      task: "Extract wall lines, openings, room labels, dimensions, then return RecognizedPlanGraph."
    },
    images: [{ base64: image.base64, mediaType: image.mediaType }],
    toolName: "analyze_plan_vision",
    toolDescription:
      "Return a RecognizedPlanGraph with walls, openings, room labels/polygons, dimensions, and confidence.",
    schema: AnalyzePlanVisionToolInputSchema,
    maxTokens: 8192
  });

  const draft = buildPlanVersionFromGraph(vision.graph, {
    fileName,
    label: fileName ? `Vision Import / ${fileName}` : "Vision Import"
  });

  return {
    version: postProcessPlanVersion(draft),
    confidence: vision.confidence ?? estimateGraphConfidence(vision.graph),
    warnings: [...vision.warnings, ...vision.graph.warnings],
    sourceType: "image",
    importPath: "vision"
  };
}
