import { describe, expect, it } from "vitest";
import { generatePlanPrompt } from "@/lib/prompts/generatePlanPrompt";
import { buildGenerateGeometrySystemPrompt } from "@/lib/prompts/generateGeometryPrompt";
import { buildGenerateTopologySystemPrompt } from "@/lib/prompts/generateTopologyPrompt";
import { buildRefineGeometrySystemPrompt } from "@/lib/prompts/refinePlanGeometryPrompt";
import {
  buildGeometryPromptSupplement,
  buildTopologyPromptSupplement,
  buildTypologyPromptSupplement
} from "@/lib/prompts/typologySupplement";
import { getGeometryPromptContext } from "@/lib/typology/topology";
import { officeTypologyPack } from "@/lib/typology/packs";

describe("generate plan prompts", () => {
  it("splits topology and geometry responsibilities", () => {
    const topology = buildGenerateTopologySystemPrompt();
    const geometry = buildGenerateGeometrySystemPrompt();

    expect(topology.toLowerCase()).toContain("phase 1");
    expect(topology.toLowerCase()).not.toContain("polygon");
    expect(geometry.toLowerCase()).toContain("phase 2");
    expect(geometry.toLowerCase()).toContain("polygon");
  });

  it("injects typology supplements per phase", () => {
    const topology = buildGenerateTopologySystemPrompt(buildTopologyPromptSupplement("school"));
    const geometry = buildGenerateGeometrySystemPrompt(buildGeometryPromptSupplement("school"));

    expect(topology).toContain("School");
    expect(topology).toContain("Adjacency rules");
    expect(geometry).toContain("Geometry layout for School");
    expect(geometry).toContain("Wet room types");
  });

  it("composes refinement prompt from geometry base", () => {
    const refined = buildRefineGeometrySystemPrompt(buildGeometryPromptSupplement("office"));
    expect(refined).toContain("Phase 3 micro-adjustment");
    expect(refined).toContain("Geometry layout for Office");
  });

  it("keeps deprecated monolithic prompt as combined export", () => {
    expect(generatePlanPrompt).toContain("Phase 1");
    expect(generatePlanPrompt).toContain("Phase 2");
  });

  it("builds geometry context from typology pack", () => {
    const context = getGeometryPromptContext(officeTypologyPack);
    expect(context).toContain("open_plan");
    expect(context).toContain("pantry");
  });

  it("keeps full typology supplement for copilot", () => {
    expect(buildTypologyPromptSupplement("healthcare")).toContain("Healthcare");
    expect(buildTypologyPromptSupplement("healthcare")).toContain("furniture");
  });
});
