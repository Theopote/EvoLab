import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { detectGapsAndOverlaps } from "@/lib/geometry-validate";
import { buildPriorSchemeNote, SCHEME_STRATEGIES, strategyForIndex } from "@/lib/scheme-strategies";
import { enforceSectionScope } from "@/lib/report-section-scope";
import type { ReportSection } from "@/lib/report-types";

describe("scheme-strategies", () => {
  it("cycles strategies by index", () => {
    expect(strategyForIndex(0).id).toBe("circulation_first");
    expect(strategyForIndex(2).id).toBe("compact_first");
    expect(strategyForIndex(3).id).toBe("circulation_first");
  });

  it("builds prior scheme avoidance note", () => {
    const note = buildPriorSchemeNote([initialProjectData.versions[0]!]);
    expect(note).toContain("Previously generated schemes");
    expect(note).toContain("differ");
  });

  it("exposes three strategies", () => {
    expect(SCHEME_STRATEGIES).toHaveLength(3);
  });
});

describe("geometry-validate", () => {
  it("detects no issues for mock version rooms inside outline", () => {
    const version = initialProjectData.versions[0]!;
    const issues = detectGapsAndOverlaps(version.outline, version.rooms);
    expect(issues.every((issue) => issue.kind !== "overlap")).toBe(true);
  });
});

describe("report-section-scope", () => {
  const base: ReportSection[] = [
    {
      id: "section-a",
      title: "A",
      grounding: { versionId: "v1", generatedAt: "now", facts: {} },
      blocks: [{ id: "a1", type: "paragraph", content: "alpha" }]
    },
    {
      id: "section-b",
      title: "B",
      grounding: { versionId: "v1", generatedAt: "now", facts: {} },
      blocks: [{ id: "b1", type: "paragraph", content: "beta" }]
    }
  ];

  it("keeps out-of-scope sections unchanged", () => {
    const aiModified: ReportSection[] = [
      {
        ...base[0]!,
        blocks: [{ id: "a1", type: "paragraph", content: "changed" }]
      },
      {
        ...base[1]!,
        blocks: [{ id: "b1", type: "paragraph", content: "hacked" }]
      }
    ];

    const merged = enforceSectionScope(base, aiModified, "section-a");
    expect(merged[0]?.blocks[0]?.content).toBe("changed");
    expect(merged[1]?.blocks[0]?.content).toBe("beta");
  });
});
