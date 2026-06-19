import { formatCost, calculateCostEstimate } from "@/lib/cost-engine";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import { calculateQuantities, checkCompliance } from "@/lib/quantity-engine";
import type { ReportDocument, ReportSection, ReportSectionGrounding } from "@/lib/report-types";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import { summarizeVersionEvolution } from "@/lib/presentation/version-evolution";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext } from "@/lib/site-types";

function blockId(sectionId: string, suffix: string) {
  return `${sectionId}-${suffix}`;
}

function buildGrounding(version: PlanVersion, facts: ReportSectionGrounding["facts"]): ReportSectionGrounding {
  return {
    versionId: version.id,
    generatedAt: new Date().toISOString(),
    facts
  };
}

export function buildReportDocument(input: {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  envelope?: BuildableEnvelope;
  environmentSurrogate?: EnvironmentSurrogate;
}): ReportDocument {
  const scored = ensureVersionScores(input.version, scoringInputFromDomain(input.project.domain, input.project.projectType));
  const quantities = calculateQuantities(scored);
  const cost = calculateCostEstimate(scored, input.project.projectType);
  const compliance = checkCompliance(scored, input.project.domain.codeContext);
  const evolution = summarizeVersionEvolution(input.project, scored);
  const warnings = compliance.filter((item) => item.status === "warning");

  const overviewFacts = {
    projectName: input.project.projectName,
    projectType: input.project.projectType,
    versionLabel: scored.label,
    grossAreaSqm: quantities.summary.grossArea,
    netAreaSqm: quantities.summary.netUsableArea,
    roomCount: scored.rooms.length,
    totalScore: scored.scores?.breakdown?.totalScore ?? 0,
    riskCount: scored.scores?.riskCount ?? 0
  };

  const performanceFacts = {
    areaEfficiency: scored.scores?.areaEfficiency ?? 0,
    circulationScore: scored.scores?.circulationScore ?? 0,
    daylightScore: scored.scores?.daylightScore ?? 0,
    mepAlignmentScore: scored.scores?.mepAlignmentScore ?? 0,
    circulationRatio: quantities.summary.circulationRatio,
    windowCount: quantities.summary.windowCount
  };

  const sections: ReportSection[] = [
    {
      id: "section-overview",
      title: "Project Overview",
      grounding: buildGrounding(scored, overviewFacts),
      blocks: [
        {
          id: blockId("section-overview", "p1"),
          type: "paragraph",
          content:
            input.brief?.description ??
            `${input.project.projectName} is a ${input.project.projectType} scheme generated from editable semantic plan data in EvoLab.`
        },
        {
          id: blockId("section-overview", "metrics"),
          type: "table",
          table: {
            headers: ["Metric", "Value"],
            rows: [
              ["Gross area", `${quantities.summary.grossArea} sqm`],
              ["Net usable area", `${quantities.summary.netUsableArea} sqm`],
              ["Rooms", String(scored.rooms.length)],
              ["Total score", String(scored.scores?.breakdown?.totalScore ?? 0)]
            ]
          }
        }
      ]
    },
    {
      id: "section-performance",
      title: "Design Performance",
      grounding: buildGrounding(scored, performanceFacts),
      blocks: [
        {
          id: blockId("section-performance", "p1"),
          type: "paragraph",
          content: `Area efficiency ${scored.scores?.areaEfficiency ?? 0}, circulation ${scored.scores?.circulationScore ?? 0}, daylight ${scored.scores?.daylightScore ?? 0}, and MEP alignment ${scored.scores?.mepAlignmentScore ?? 0}. Circulation accounts for ${Math.round(quantities.summary.circulationRatio * 100)}% of gross area.`
        },
        {
          id: blockId("section-performance", "plan"),
          type: "image_ref",
          imageRef: { kind: "plan", caption: `${scored.label} floor plan` }
        }
      ]
    },
    {
      id: "section-evolution",
      title: "Scheme Evolution",
      grounding: buildGrounding(scored, {
        versionCount: evolution.versionCount,
        activeLabel: evolution.activeLabel,
        narratives: evolution.evolutionNarrative
      }),
      blocks: [
        {
          id: blockId("section-evolution", "bullets"),
          type: "bullet_list",
          bullets: evolution.evolutionNarrative
        },
        ...(evolution.rows.length > 1
          ? [
              {
                id: blockId("section-evolution", "table"),
                type: "table" as const,
                table: {
                  headers: ["Version", "Rooms", "Gross sqm", "Score"],
                  rows: evolution.rows.map((row) => [
                    row.isActive ? `${row.label} *` : row.label,
                    String(row.rooms),
                    String(row.grossArea),
                    String(row.totalScore)
                  ])
                }
              }
            ]
          : [])
      ]
    },
    {
      id: "section-cost-compliance",
      title: "Cost & Compliance",
      grounding: buildGrounding(scored, {
        estimatedCost: cost.totalCost,
        currency: cost.currency,
        complianceWarnings: warnings.map((item) => item.message),
        riskCount: scored.scores?.riskCount ?? 0
      }),
      blocks: [
        {
          id: blockId("section-cost-compliance", "p1"),
          type: "paragraph",
          content: `Indicative construction cost ${formatCost(cost.totalCost, cost.currency)}. ${warnings.length ? `${warnings.length} compliance warning(s) require review.` : "No compliance warnings on the active scheme."}`
        },
        {
          id: blockId("section-cost-compliance", "bullets"),
          type: "bullet_list",
          bullets: warnings.length
            ? warnings.map((item) => item.message)
            : ["Compliance checks passed without warnings on the active scheme."]
        }
      ]
    }
  ];

  return {
    id: `report-${scored.id}`,
    title: `${input.project.projectName} Design Report`,
    sections
  };
}

export function findReportSection(document: ReportDocument, sectionId: string) {
  return document.sections.find((section) => section.id === sectionId);
}

export function findReportBlock(section: ReportSection, blockIdValue: string) {
  return section.blocks.find((block) => block.id === blockIdValue);
}
