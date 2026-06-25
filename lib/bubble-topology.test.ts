import { describe, expect, it } from "vitest";
import {
  cycleBubbleRelationship,
  edgePairKey,
  removeBubbleEdge,
  upsertBubbleEdge
} from "@/lib/bubble-topology";

describe("bubble-topology", () => {
  it("cycles relationship types and removes on final step", () => {
    expect(cycleBubbleRelationship(undefined)).toBe("direct");
    expect(cycleBubbleRelationship("direct")).toBe("near");
    expect(cycleBubbleRelationship("near")).toBe("separated");
    expect(cycleBubbleRelationship("separated")).toBeNull();
  });

  it("upserts and removes undirected edges", () => {
    const edges = upsertBubbleEdge([], "a", "b", "direct");
    expect(edges).toHaveLength(1);
    expect(edgePairKey(edges[0]!.from, edges[0]!.to)).toBe("a|b");

    const updated = upsertBubbleEdge(edges, "b", "a", "near");
    expect(updated[0]?.relationship).toBe("near");

    const removed = removeBubbleEdge(updated, "a", "b");
    expect(removed).toHaveLength(0);
  });
});
