import { describe, expect, it } from "vitest";
import { buildCompareReport } from "@/lib/compare/build-compare-report";
import { renderCompareReportHtml } from "@/lib/compare/render-compare-html";
import { createDemoProjectData } from "@/lib/typologies";

describe("compare report export", () => {
  function demoVersions() {
    const project = createDemoProjectData("office");
    const primary = project.versions[0]!;

    return {
      project,
      versions: [
        primary,
        {
          ...primary,
          id: `${primary.id}-alt`,
          label: `${primary.label} B`,
          createdAt: new Date(Date.now() + 60_000).toISOString()
        }
      ]
    };
  }

  it("builds a report for pinned versions", () => {
    const { project, versions } = demoVersions();
    const activeVersion = versions[0]!;
    const compareVersionIds = versions.map((version) => version.id);

    const report = buildCompareReport({
      projectName: project.projectName,
      projectType: project.projectType,
      domain: project.domain,
      program: project.domain.program,
      activeVersionId: activeVersion.id,
      versions,
      compareVersionIds
    });

    expect(report).not.toBeNull();
    expect(report?.versions.length).toBeGreaterThanOrEqual(2);
    expect(report?.metricTable.rows.length).toBeGreaterThanOrEqual(2);
    expect(report?.recommendation.versionLabel.length).toBeGreaterThan(0);
    expect(report?.diff?.svg).toContain("<svg");
  });

  it("renders exportable html with recommendation and metrics", () => {
    const { project, versions } = demoVersions();
    const report = buildCompareReport({
      projectName: project.projectName,
      projectType: project.projectType,
      domain: project.domain,
      program: project.domain.program,
      activeVersionId: versions[0]!.id,
      versions,
      compareVersionIds: versions.map((version) => version.id)
    });

    expect(report).not.toBeNull();
    const html = renderCompareReportHtml(report!);

    expect(html).toContain("Scheme Comparison");
    expect(html).toContain("Recommendation");
    expect(html).toContain("Metric comparison");
    expect(html).toContain(report!.recommendation.versionLabel);
  });
});
