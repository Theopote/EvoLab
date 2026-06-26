import { describe, expect, it } from "vitest";
import { DEFAULT_PROMPT_REFS, listPromptTemplates, resolvePrompt } from "@/lib/prompts/registry";

describe("prompt registry", () => {
  it("lists versioned prompt templates", () => {
    const templates = listPromptTemplates();
    expect(templates.some((item) => item.ref === DEFAULT_PROMPT_REFS.generatePlanTopology)).toBe(true);
    expect(templates.some((item) => item.ref === DEFAULT_PROMPT_REFS.copilotModify)).toBe(true);
  });

  it("resolves topology prompt with few-shot block", () => {
    const prompt = resolvePrompt(DEFAULT_PROMPT_REFS.generatePlanTopology, {
      projectType: "healthcare",
      includeFewShot: true
    });

    expect(prompt.toLowerCase()).toContain("phase 1");
    expect(prompt).toContain("Example —");
    expect(prompt).toContain("Outpatient");
  });

  it("resolves copilot modify prompt", () => {
    const prompt = resolvePrompt(DEFAULT_PROMPT_REFS.copilotModify);
    expect(prompt).toContain("propose_plan_changes");
  });
});
