import type { TopologyGraphEdge } from "@/lib/project-types";

export type BubbleRelationship = TopologyGraphEdge["relationship"];

export const bubbleRelationshipOrder: BubbleRelationship[] = ["direct", "near", "separated"];

export function edgePairKey(from: string, to: string) {
  return [from, to].sort().join("|");
}

export function findEdge(edges: TopologyGraphEdge[], from: string, to: string) {
  const key = edgePairKey(from, to);
  return edges.find((edge) => edgePairKey(edge.from, edge.to) === key);
}

export function cycleBubbleRelationship(current?: BubbleRelationship): BubbleRelationship | null {
  if (!current) {
    return "direct";
  }

  const index = bubbleRelationshipOrder.indexOf(current);
  if (index < 0 || index === bubbleRelationshipOrder.length - 1) {
    return null;
  }

  return bubbleRelationshipOrder[index + 1];
}

export function upsertBubbleEdge(
  edges: TopologyGraphEdge[],
  from: string,
  to: string,
  relationship: BubbleRelationship
): TopologyGraphEdge[] {
  const key = edgePairKey(from, to);
  const existing = edges.find((edge) => edgePairKey(edge.from, edge.to) === key);

  if (existing) {
    return edges.map((edge) =>
      edgePairKey(edge.from, edge.to) === key ? { ...edge, relationship } : edge
    );
  }

  return [...edges, { from, to, relationship }];
}

export function removeBubbleEdge(edges: TopologyGraphEdge[], from: string, to: string) {
  const key = edgePairKey(from, to);
  return edges.filter((edge) => edgePairKey(edge.from, edge.to) !== key);
}

export function edgeStrokeStyle(relationship: BubbleRelationship) {
  switch (relationship) {
    case "direct":
      return { stroke: "#5eead4", strokeWidth: 2.5, strokeDasharray: undefined };
    case "near":
      return { stroke: "#facc15", strokeWidth: 2, strokeDasharray: "5 4" };
    case "separated":
      return { stroke: "#64748b", strokeWidth: 1.5, strokeDasharray: "8 6" };
  }
}
