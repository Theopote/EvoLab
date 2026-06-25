import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { buildTypologyPromptSupplement } from "@/lib/prompts/typologySupplement";
import { resolveSchedulePreset } from "@/lib/typologies/schedules";
import { listFurniturePresets } from "@/lib/typologies/furniture";
import { resolveCodeContextFromTypology } from "@/lib/typologies/code-context";
import { DEFAULT_TYPOLOGY_ID, createDemoProjectData } from "@/lib/typologies";
import { resolveTypologyPackId } from "@/lib/typology/resolve";

describe("typologies facade", () => {
  it("defaults to office instead of healthcare", () => {
    expect(DEFAULT_TYPOLOGY_ID).toBe("office");
    expect(resolveTypologyPackId()).toBe("office");
    expect(initialProjectData.projectType).toBe("office");
    expect(initialProjectData.projectName.toLowerCase()).toContain("office");
  });

  it("builds healthcare demo data when requested", () => {
    const healthcare = createDemoProjectData("healthcare");
    expect(healthcare.projectType).toBe("healthcare");
    expect(healthcare.versions[0]?.rooms.some((room) => room.type === "consultation")).toBe(true);
  });

  it("switches code context, schedules, furniture, and prompts by typology", () => {
    const officeCode = resolveCodeContextFromTypology("office");
    const schoolCode = resolveCodeContextFromTypology("school");

    expect(officeCode.label).toContain("Office");
    expect(schoolCode.label).toContain("School");
    expect(resolveSchedulePreset("office").roomScheduleTitle).toContain("Space");
    expect(resolveSchedulePreset("school").roomScheduleTitle).toContain("Teaching");
    expect(listFurniturePresets("office").some((item) => item.id === "workstation")).toBe(true);
    expect(buildTypologyPromptSupplement("school")).toContain("School");
    expect(buildTypologyPromptSupplement("office")).toContain("Open Workspace");
  });
});
