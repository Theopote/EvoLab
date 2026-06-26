import { describe, expect, it } from "vitest";
import {
  buildRemixDiffReport,
  previewFocusHint,
  previewModeForRoomFocus
} from "@/lib/retained-structure/remix-diff";
import { defaultRemixParameters } from "@/lib/retained-structure/remix-parameters";
import { remixPlanWithRetainedStructure } from "@/lib/retained-structure/remix-plan-version";
import { createDemoProjectData } from "@/lib/typologies";

describe("buildRemixDiffReport", () => {
  const source = createDemoProjectData("healthcare").versions[0]!;
  const parameters = defaultRemixParameters({ relayoutableRoomCount: 5 });

  it("classifies preserved structure rooms separately from program changes", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline,
      ...parameters,
      targetFunctionalType: "office"
    });

    const report = buildRemixDiffReport(source, remixed, {
      ...parameters,
      targetFunctionalType: "office"
    });

    expect(report.summary.preservedStructureCount).toBeGreaterThan(0);
    expect(report.preserved.every((room) => room.kind === "preserved")).toBe(true);
    expect(report.preserved.every((room) => room.areaDeltaSqm === 0 || room.areaDeltaSqm === undefined)).toBe(true);
  });

  it("includes rationale and zone summary after relayout", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline,
      ...parameters,
      targetFunctionalType: "residential",
      corridorStrategy: "side",
      layoutPriority: "circulation"
    });

    const report = buildRemixDiffReport(source, remixed, {
      ...parameters,
      targetFunctionalType: "residential",
      corridorStrategy: "side",
      layoutPriority: "circulation"
    });

    expect(report.rationale.length).toBeGreaterThanOrEqual(3);
    expect(report.rationale.some((line) => line.includes("住宅"))).toBe(true);
    expect(report.zoneSummary.length).toBe(5);
    expect(report.circulationSummary.length).toBeGreaterThan(0);
    expect(report.summary.relayoutedCount).toBeGreaterThan(0);
  });

  it("lists added and removed rooms when functional type changes", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline,
      ...parameters,
      targetFunctionalType: "commercial",
      targetRoomCount: 5
    });

    const report = buildRemixDiffReport(source, remixed, {
      ...parameters,
      targetFunctionalType: "commercial",
      targetRoomCount: 5
    });

    expect(report.added.length + report.removed.length + report.changed.length).toBeGreaterThan(0);
    expect(report.risks.length).toBeGreaterThan(0);
  });
});

describe("remix preview focus helpers", () => {
  it("routes removed rooms to before preview and added rooms to after preview", () => {
    expect(previewModeForRoomFocus({ kind: "removed" }, "after")).toBe("before");
    expect(previewModeForRoomFocus({ kind: "added" }, "before")).toBe("after");
    expect(previewModeForRoomFocus({ kind: "modified" }, "after")).toBe("after");
  });

  it("shows hints when the focused room is not visible in the current preview", () => {
    expect(previewFocusHint({ kind: "removed", name: "诊室 A" }, "after")).toContain("重划前");
    expect(previewFocusHint({ kind: "added", name: "办公 B" }, "before")).toContain("重划后");
    expect(previewFocusHint({ kind: "modified", name: "走廊" }, "after")).toBeUndefined();
  });
});
