import { describe, expect, it } from "vitest";
import { getBuildingType, getBuildingTypeLabel } from "@/lib/building-types/catalog";
import { createBlankProjectBundle, createDemoProjectBundle } from "@/lib/projects/create-project";

describe("building type catalog", () => {
  it("covers common building categories", () => {
    expect(getBuildingTypeLabel("office")).toBe("办公建筑");
    expect(getBuildingTypeLabel("factory")).toBe("工厂");
    expect(getBuildingTypeLabel("retail")).toBe("商店 / 零售");
    expect(getBuildingTypeLabel("hospital")).toBe("医院");
  });

  it("falls back to office for unknown ids", () => {
    expect(getBuildingType("unknown-type").id).toBe("office");
  });
});

describe("create-project", () => {
  it("creates blank projects without versions", () => {
    const bundle = createBlankProjectBundle(
      { projectName: "测试厂房", buildingTypeId: "factory" },
      "evolab-test-factory"
    );

    expect(bundle.project.projectId).toBe("evolab-test-factory");
    expect(bundle.project.projectType).toBe("factory");
    expect(bundle.project.versions).toHaveLength(0);
    expect(bundle.workflowPhase).toBe("import");
    expect(bundle.activeTab).toBe("Import");
  });

  it("creates demo projects with a starter scheme", () => {
    const bundle = createDemoProjectBundle(
      { projectName: "测试学校", buildingTypeId: "school", startMode: "demo" },
      "evolab-test-school"
    );

    expect(bundle.project.projectType).toBe("school");
    expect(bundle.project.versions.length).toBeGreaterThan(0);
    expect(bundle.workflowPhase).toBe("scheme");
  });
});
