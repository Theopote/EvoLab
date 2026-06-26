import { buildFewShotPromptBlock } from "@/lib/prompts/few-shot/examples";
import { buildGenerateGeometrySystemPrompt } from "@/lib/prompts/generateGeometryPrompt";
import { buildGenerateTopologySystemPrompt } from "@/lib/prompts/generateTopologyPrompt";
import { buildRefineGeometrySystemPrompt } from "@/lib/prompts/refinePlanGeometryPrompt";
import { proposePlanChangesPrompt } from "@/lib/prompts/proposePlanChangesPrompt";
import {
  buildGeometryPromptSupplement,
  buildTopologyPromptSupplement
} from "@/lib/prompts/typologySupplement";

export interface PromptBuildOptions {
  projectType?: string;
  includeFewShot?: boolean;
}

export interface PromptTemplateDefinition {
  id: string;
  version: string;
  route: string;
  build: (options?: PromptBuildOptions) => string;
}

function refKey(id: string, version: string) {
  return `${id}@v${version}`;
}

function withFewShot(base: string, options?: PromptBuildOptions) {
  if (!options?.includeFewShot) {
    return base;
  }

  const fewShot = buildFewShotPromptBlock(options.projectType);
  return `${base}\n\nFew-shot references (${options.projectType ?? "default"}):\n${fewShot}`;
}

const PROMPT_REGISTRY: Record<string, PromptTemplateDefinition> = {
  [refKey("generate-plan-topology", "2")]: {
    id: "generate-plan-topology",
    version: "2",
    route: "/api/generate-plan",
    build: (options) =>
      withFewShot(
        buildGenerateTopologySystemPrompt(buildTopologyPromptSupplement(options?.projectType)),
        { ...options, includeFewShot: options?.includeFewShot ?? true }
      )
  },
  [refKey("generate-plan-geometry", "2")]: {
    id: "generate-plan-geometry",
    version: "2",
    route: "/api/generate-plan",
    build: (options) =>
      buildGenerateGeometrySystemPrompt(buildGeometryPromptSupplement(options?.projectType))
  },
  [refKey("generate-plan-refine", "2")]: {
    id: "generate-plan-refine",
    version: "2",
    route: "/api/generate-plan",
    build: (options) =>
      buildRefineGeometrySystemPrompt(buildGeometryPromptSupplement(options?.projectType))
  },
  [refKey("copilot-modify", "1")]: {
    id: "copilot-modify",
    version: "1",
    route: "/api/modify-plan",
    build: () => proposePlanChangesPrompt
  }
};

export const DEFAULT_PROMPT_REFS = {
  generatePlanTopology: "generate-plan-topology@v2",
  generatePlanGeometry: "generate-plan-geometry@v2",
  generatePlanRefine: "generate-plan-refine@v2",
  copilotModify: "copilot-modify@v1"
} as const;

export function parsePromptRef(ref: string) {
  const [id, versionPart] = ref.split("@");
  const version = versionPart?.startsWith("v") ? versionPart.slice(1) : versionPart ?? "1";
  return { id, version, ref: refKey(id, version) };
}

export function resolvePrompt(ref: string, options?: PromptBuildOptions): string {
  const parsed = parsePromptRef(ref);
  const template = PROMPT_REGISTRY[parsed.ref];

  if (!template) {
    throw new Error(`Unknown prompt template: ${ref}`);
  }

  return template.build(options);
}

export function listPromptTemplates() {
  return Object.values(PROMPT_REGISTRY).map((template) => ({
    id: template.id,
    version: template.version,
    route: template.route,
    ref: refKey(template.id, template.version)
  }));
}
