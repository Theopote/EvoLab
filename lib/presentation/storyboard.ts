import { createPlanSvg } from "@/lib/export-utils";
import { calculateQuantities } from "@/lib/quantity-engine";
import {
  renderExplodedDiagram,
  renderFlowDiagram,
  renderIsometricDiagram,
  renderZoneDiagram
} from "@/lib/presentation/diagrams";
import type { PresentationDeck, PresentationSlide, StoryboardRequest } from "@/lib/presentation/types";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import type { BuildableEnvelope, SiteContext } from "@/lib/site-types";

function scoreLine(version: PlanVersion) {
  const scores = version.scores;
  if (!scores) {
    return "Performance scores pending.";
  }

  return `Area ${scores.areaEfficiency} · Flow ${scores.circulationScore} · Daylight ${scores.daylightScore} · MEP ${scores.mepAlignmentScore} · Risks ${scores.riskCount}`;
}

export function buildPresentationDeck(input: {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  envelope?: BuildableEnvelope;
}): PresentationDeck {
  const quantities = calculateQuantities(input.version);
  const slides: PresentationSlide[] = [
    {
      id: "slide-cover",
      kind: "cover",
      title: input.project.projectName,
      subtitle: `${input.project.projectType} · ${input.version.label}`,
      bullets: [
        input.brief?.description ?? "Design generated from editable semantic plan data in EvoLab.",
        scoreLine(input.version)
      ]
    },
    {
      id: "slide-site",
      kind: "site",
      title: "Site & Context",
      subtitle: input.siteContext?.address.displayName ?? "Local site outline",
      bullets: input.siteContext
        ? [
            `${input.siteContext.buildings.length} surrounding buildings · ${input.siteContext.roads.length} road segments`,
            `Data source: ${input.siteContext.source}`,
            input.envelope?.valid
              ? `Buildable envelope: ${input.envelope.maxFloorAreaSqm} sqm footprint cap · ${input.envelope.maxHeightMeters}m height`
              : "Zoning envelope not applied."
          ]
        : ["Draw or fetch site context before presentation export for richer site storytelling."]
    },
    {
      id: "slide-massing",
      kind: "massing",
      title: "Massing Study",
      subtitle: "Isometric volume reading",
      bullets: [
        `Gross area ${quantities.summary.grossArea} sqm · Net ${quantities.summary.netUsableArea} sqm`,
        `Service ${quantities.areaByZone.service} sqm · Circulation ${quantities.areaByZone.circulation} sqm`,
        "Exploded axonometric clarifies functional layering."
      ],
      svg: renderIsometricDiagram(input.version)
    },
    {
      id: "slide-exploded",
      kind: "massing",
      title: "Exploded Axonometric",
      subtitle: "Auto-annotated room decomposition",
      bullets: ["Each room block is radially separated for design review and client communication."],
      svg: renderExplodedDiagram(input.version)
    },
    {
      id: "slide-plan",
      kind: "plan",
      title: "Plan & Program",
      subtitle: `${input.version.rooms.length} rooms`,
      bullets: [
        `Outline ${input.version.overallBounds.width} × ${input.version.overallBounds.height} m`,
        input.version.metadata?.strategy ?? "Functional strategy recorded in version metadata."
      ],
      svg: createPlanSvg(input.version)
    },
    {
      id: "slide-zones",
      kind: "zones",
      title: "Functional Zoning",
      subtitle: "Public / private / service / circulation",
      bullets: Object.entries(quantities.areaByZone).map(([zone, area]) => `${zone}: ${area} sqm`),
      svg: renderZoneDiagram(input.version)
    },
    {
      id: "slide-flow",
      kind: "flow",
      title: "Circulation & Sightline",
      subtitle: "Patient / staff flow with egress and sight cones",
      bullets: [
        "Blue: patient route · Purple: staff route · Green: egress paths · Pink: sightline cone",
        "Derived from graph pathfinding and raycasting analysis."
      ],
      svg: renderFlowDiagram(input.version)
    },
    {
      id: "slide-quantities",
      kind: "quantities",
      title: "Area & Quantity Schedule",
      subtitle: "Data-driven takeoff from activeVersion",
      bullets: [`Wall area ${quantities.summary.wallArea} sqm · Rooms ${input.version.rooms.length}`],
      table: {
        headers: ["Room", "Type", "Zone", "Area (sqm)"],
        rows: input.version.rooms
          .slice(0, 12)
          .map((room) => [room.name, room.type, room.zone, String(room.areaSqm)])
      }
    }
  ];

  return {
    projectName: input.project.projectName,
    projectType: input.project.projectType,
    versionLabel: input.version.label,
    generatedAt: new Date().toISOString(),
    slides
  };
}

export function appendNarrativeSlide(deck: PresentationDeck, narrative: string[]): PresentationDeck {
  return {
    ...deck,
    designNarrative: narrative,
    slides: [
      ...deck.slides,
      {
        id: "slide-narrative",
        kind: "narrative",
        title: "Design Narrative",
        subtitle: "AI-authored project story",
        bullets: narrative
      }
    ]
  };
}

export function toStoryboardRequest(input: {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  envelope?: BuildableEnvelope;
}): StoryboardRequest {
  const quantities = calculateQuantities(input.version);

  return {
    projectName: input.project.projectName,
    projectType: input.project.projectType,
    brief: input.brief?.description,
    versionLabel: input.version.label,
    siteSummary: input.siteContext?.address.displayName,
    envelopeSummary: input.envelope?.valid
      ? `${input.envelope.maxFloorAreaSqm} sqm / ${input.envelope.maxHeightMeters}m envelope`
      : undefined,
    quantitySummary: `${quantities.summary.grossArea} sqm gross · ${input.version.rooms.length} rooms`,
    scoreSummary: scoreLine(input.version)
  };
}
