import { describe, expect, it } from "vitest";
import { createDemoProjectData } from "@/lib/typologies/demo-project";
import { buildRenderBrief, buildStructuredRenderPrompt } from "@/lib/presentation/render-prompt";

describe("render-prompt", () => {
  const version = createDemoProjectData("office").versions[0]!;

  it("builds a data-driven brief from activeVersion geometry", () => {
    const brief = buildRenderBrief(version, {
      materialStyle: "White clay",
      lighting: "North daylight",
      cameraView: "Aerial axonometric",
      purpose: "AI image brief",
      notes: "Restrained BIM massing.",
      projectType: "office"
    });

    expect(brief).toContain(`Project: ${version.label}`);
    expect(brief).toContain("Typology: office.");
    expect(brief).toContain("Footprint:");
    expect(brief).toContain("Levels:");
    expect(brief).toContain("Material style: White clay.");
    expect(brief).toContain("Rooms:");
  });

  it("builds structured SD/DALL-E payload with positive and negative prompts", () => {
    const payload = buildStructuredRenderPrompt(version, {
      materialStyle: "Glass and metal",
      lighting: "Golden hour",
      cameraView: "Entrance eye-level",
      purpose: "Client review",
      notes: "Readable facade rhythm.",
      projectType: "office"
    });

    expect(payload.positive_prompt).toContain("glass and metal");
    expect(payload.positive_prompt).toContain("golden hour");
    expect(payload.negative_prompt).toContain("watermark");
    expect(payload.metadata.roomCount).toBeGreaterThan(0);
    expect(payload.controlnet.recommended).toBe("depth");
    expect(payload.brief).toContain("Project:");
  });
});
