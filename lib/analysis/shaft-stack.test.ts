import { describe, expect, it } from "vitest";
import { buildShaftStacks, computeWetStackPathMetrics } from "@/lib/analysis/shaft-stack";
import { initialProjectData } from "@/lib/evolab-data";
import { computeWetCorePathMetrics } from "@/lib/rules/path-metrics";

const baseVersion = initialProjectData.versions[0]!;

describe("shaft stack paths", () => {
  it("groups shaft rooms into stacks", () => {
    const stacks = buildShaftStacks(baseVersion);

    expect(stacks.length).toBeGreaterThan(0);
    expect(stacks[0]?.roomIds.length).toBeGreaterThan(0);
  });

  it("routes wet rooms to a shaft stack with horizontal path metadata", () => {
    const metrics = computeWetStackPathMetrics(baseVersion);
    const wetRoom = metrics.perRoom.find((item) => item.roomId === "consult-01");

    expect(wetRoom).toBeDefined();
    expect(wetRoom?.stackId).toBeDefined();
    expect(wetRoom?.horizontalDistance).toBeGreaterThan(0);
    expect(wetRoom?.horizontalPath.length).toBeGreaterThan(1);
  });

  it("exposes stack metadata through wet-core path metrics", () => {
    const metrics = computeWetCorePathMetrics(baseVersion);
    const wetRoom = metrics.perRoom.find((item) => item.roomId === "consult-01");

    expect(wetRoom?.stackId).toBeDefined();
    expect(wetRoom?.missingLinks).toBeDefined();
  });
});
