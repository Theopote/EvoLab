import { describe, expect, it } from "vitest";
import { createDemoProjectData } from "@/lib/typologies";
import { buildCompareSlide } from "@/lib/presentation/compare-slide";
import { getFlowSlideCopy } from "@/lib/presentation/flow-copy";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { topologyGraphFromTopology } from "@/lib/topology-graph";
import { buildPlanTopologyVersionsFromPack } from "@/lib/typology/topology";
import { officeTypologyPack, schoolTypologyPack } from "@/lib/typology/packs";

describe("presentation slide builders", () => {
  it("uses typology-aware flow copy for office and school", () => {
    const office = getFlowSlideCopy("office");
    const school = getFlowSlideCopy("school");

    expect(office.subtitle.toLowerCase()).not.toContain("patient");
    expect(school.subtitle.toLowerCase()).toContain("student");
    expect(office.bullets[0]).toContain("Blue:");
  });

  it("adds topology, facade, systems, and compare slides to the deck", () => {
    const project = createDemoProjectData("office");
    const activeVersion = project.versions[0]!;
    const topology = buildPlanTopologyVersionsFromPack(officeTypologyPack, 1200)[0];
    const versionWithGraph = {
      ...activeVersion,
      metadata: {
        ...activeVersion.metadata,
        topologyGraph: topologyGraphFromTopology(topology)
      },
      mep: {
        shafts: [{ id: "shaft-1", position: [12, 8] as [number, number], systems: ["hvac" as const] }],
        routes: [
          {
            id: "route-1",
            system: "hvac" as const,
            path: [
              [10, 8],
              [20, 8]
            ] as [number, number][],
            connectsRoomIds: ["corridor-01"]
          }
        ]
      }
    };
    const secondVersion = {
      ...versionWithGraph,
      id: "scheme-b",
      label: "Scheme B",
      metadata: { ...versionWithGraph.metadata, strategy: "Side Core" }
    };

    const deck = buildPresentationDeck({
      project: {
        ...project,
        versions: [versionWithGraph, secondVersion],
        domain: {
          ...project.domain,
          facadeEnvelope: {
            id: "facade-1",
            defaultWindowRatio: 0.4,
            orientationStrategy: "South-facing public edge",
            zones: [
              {
                id: "zone-south",
                levelId: activeVersion.levels[0]?.id ?? "level-1",
                edge: "south",
                strategy: "curtain_wall",
                targetWindowRatio: 0.55
              }
            ]
          }
        }
      },
      version: versionWithGraph,
      compareVersionIds: [versionWithGraph.id, secondVersion.id]
    });

    const kinds = deck.slides.map((slide) => slide.kind);
    expect(kinds).toContain("topology");
    expect(kinds).toContain("facade");
    expect(kinds).toContain("systems");
    expect(kinds).toContain("compare");
    expect(deck.slides.find((slide) => slide.id === "slide-topology")?.svg).toContain("<circle");
    expect(deck.slides.find((slide) => slide.id === "slide-compare")?.table?.rows).toHaveLength(2);
  });

  it("builds compare slide from pinned version ids", () => {
    const project = createDemoProjectData("healthcare");
    const [first, second] = project.versions.length >= 2
      ? project.versions
      : [
          project.versions[0]!,
          { ...project.versions[0]!, id: "alt-scheme", label: "Alt scheme" }
        ];

    const slide = buildCompareSlide(
      { ...project, versions: [first, second] },
      first,
      [first.id, second.id]
    );

    expect(slide?.kind).toBe("compare");
    expect(slide?.table?.rows).toHaveLength(2);
  });
});
