import { formatCost, calculateCostEstimate } from "@/lib/cost-engine";
import { createPlanSvg } from "@/lib/export-utils";
import { calculateQuantities } from "@/lib/quantity-engine";
import { buildCompareSlide } from "@/lib/presentation/compare-slide";
import {
  renderEnvironmentDiagram,
  renderEvolutionDiagram,
  renderExplodedDiagram,
  renderFacadeDiagram,
  renderFlowDiagram,
  renderIsometricDiagram,
  renderSystemsDiagram,
  renderTopologyDiagram,
  renderZoneDiagram
} from "@/lib/presentation/diagrams";
import { getFlowSlideCopy } from "@/lib/presentation/flow-copy";
import { createModelSlidePlaceholder } from "@/lib/presentation/model-slide";
import type { PresentationDeck, PresentationSlide, StoryboardRequest } from "@/lib/presentation/types";
import { summarizeVersionEvolution } from "@/lib/presentation/version-evolution";
import type { DesignBrief, PlanVersion, Point, ProjectData } from "@/lib/project-types";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext } from "@/lib/site-types";

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
  environmentSurrogate?: EnvironmentSurrogate;
  outline?: Point[];
  compareVersionIds?: string[];
}): PresentationDeck {
  const quantities = calculateQuantities(input.version);
  const cost = calculateCostEstimate(input.version, input.project.projectType);
  const evolution = summarizeVersionEvolution(input.project, input.version);
  const flowCopy = getFlowSlideCopy(input.project.projectType);
  const topologyGraph = input.version.metadata?.topologyGraph;
  const facadeEnvelope = input.project.domain.facadeEnvelope;
  const mep = input.version.mep;
  const compareSlide = buildCompareSlide(input.project, input.version, input.compareVersionIds);

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
      id: "slide-evolution",
      kind: "evolution",
      title: "Design Evolution",
      subtitle: `${evolution.versionCount} options · active ${evolution.activeLabel}`,
      bullets: evolution.evolutionNarrative,
      svg: renderEvolutionDiagram(input.version),
      table:
        evolution.rows.length > 1
          ? {
              headers: ["Version", "Rooms", "Gross sqm", "Score"],
              rows: evolution.rows.map((row) => [
                row.isActive ? `${row.label} *` : row.label,
                String(row.rooms),
                String(row.grossArea),
                String(row.totalScore)
              ])
            }
          : undefined
    },
    ...(topologyGraph
      ? [
          {
            id: "slide-topology",
            kind: "topology" as const,
            title: "Room Topology",
            subtitle: topologyGraph.strategy,
            bullets: [
              topologyGraph.topology.circulation,
              topologyGraph.topology.core,
              `${topologyGraph.rooms.length} rooms · ${topologyGraph.edges.length} adjacency edges`
            ],
            svg: renderTopologyDiagram(topologyGraph)
          }
        ]
      : []),
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
    createModelSlidePlaceholder(),
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
      title: flowCopy.title,
      subtitle: flowCopy.subtitle,
      bullets: flowCopy.bullets,
      svg: renderFlowDiagram(input.version, input.project.projectType, flowCopy.legendLabel)
    },
    {
      id: "slide-facade",
      kind: "facade",
      title: "Facade & Envelope",
      subtitle: facadeEnvelope?.orientationStrategy ?? "Perimeter facade strategy",
      bullets: facadeEnvelope?.zones.length
        ? [
            `${facadeEnvelope.zones.length} facade zones · default WWR ${Math.round((facadeEnvelope.defaultWindowRatio ?? 0.35) * 100)}%`,
            facadeEnvelope.orientationStrategy ?? "Orientation strategy from facade workspace.",
            "Edge colors: curtain wall · punched window · solid · mixed."
          ]
        : [
            "Configure facade zones in the Facade workspace to enrich this slide.",
            "Default window-to-wall ratios and perimeter strategies export with the deck."
          ],
      svg: renderFacadeDiagram(input.version, facadeEnvelope)
    },
    {
      id: "slide-systems",
      kind: "systems",
      title: "Building Systems",
      subtitle: mep?.strategy?.systemConcept ?? "MEP routing overview",
      bullets: mep
        ? [
            `${mep.routes.length} routes · ${mep.shafts.length} shafts`,
            mep.strategy?.shaftLogic ?? "Shaft logic recorded when MEP is generated.",
            mep.strategy?.routingLogic ?? "Routes connect service rooms and vertical risers."
          ]
        : [
            "Generate MEP in the Systems workspace to populate routes and shafts.",
            "Service rooms, shafts, and risers will appear on this systems slide."
          ],
      svg: renderSystemsDiagram(input.version, mep)
    },
    ...(compareSlide ? [compareSlide] : []),
    {
      id: "slide-environment",
      kind: "analysis",
      title: "Environmental Context",
      subtitle: input.environmentSurrogate
        ? `Dominant wind from ${input.environmentSurrogate.dominantWindFrom}`
        : "Site surrogate analysis",
      bullets: input.environmentSurrogate
        ? (() => {
            const sunValues = input.environmentSurrogate!.cells.map((cell) => cell.sunHours);
            const windValues = input.environmentSurrogate!.cells.map((cell) => cell.windShelter);
            const avgSun = sunValues.reduce((sum, value) => sum + value, 0) / sunValues.length;
            const avgWind = windValues.reduce((sum, value) => sum + value, 0) / windValues.length;

            return [
              `Average sun proxy ${avgSun.toFixed(1)} h · wind shelter ${(avgWind * 100).toFixed(0)}%`,
              "Heatmap shows instant surrogate sun exposure and wind shelter across the site grid.",
              input.siteContext
                ? `${input.siteContext.buildings.length} context buildings inform obstruction and shelter.`
                : "Fetch site context for richer environmental storytelling."
            ];
          })()
        : ["Fetch site context to include sun and wind surrogate overlays in the deck."],
      svg:
        input.environmentSurrogate && input.outline && input.outline.length >= 3
          ? renderEnvironmentDiagram(input.environmentSurrogate, input.outline)
          : undefined
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
    },
    {
      id: "slide-cost",
      kind: "cost",
      title: "Cost Estimate",
      subtitle: `${cost.summary} · indicative ROM`,
      bullets: [
        "Indicative ROM based on gross/net area, envelope, and opening counts.",
        `Shell + MEP + fit-out + facade + doors for ${input.project.projectType}.`,
        "Replace with local QS benchmarks before client issue."
      ],
      table: {
        headers: ["Category", "Qty", "Unit", "Unit cost", "Subtotal"],
        rows: [
          ...cost.lineItems.map((item) => [
            item.category,
            String(item.quantity),
            item.unit,
            formatCost(item.unitCost, cost.currency),
            formatCost(item.subtotal, cost.currency)
          ]),
          ["Total ROM", "", "", "", formatCost(cost.totalCost, cost.currency)]
        ]
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
  environmentSurrogate?: EnvironmentSurrogate;
  outline?: Point[];
  compareVersionIds?: string[];
}): StoryboardRequest {
  const quantities = calculateQuantities(input.version);
  const cost = calculateCostEstimate(input.version, input.project.projectType);
  const evolution = summarizeVersionEvolution(input.project, input.version);
  const deck = buildPresentationDeck(input);

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
    costSummary: cost.summary,
    scoreSummary: scoreLine(input.version),
    evolutionSummary: evolution.evolutionNarrative.join(" "),
    slideCatalog: deck.slides.map((slide) => ({
      slideId: slide.id,
      kind: slide.kind,
      title: slide.title,
      subtitle: slide.subtitle
    }))
  };
}
