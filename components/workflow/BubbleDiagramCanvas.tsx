"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import type { TopologyGraph, TopologyGraphEdge, TopologyGraphRoom } from "@/lib/project-types";

interface BubbleDiagramCanvasProps {
  topology?: TopologyGraph;
  programLabel?: string;
  onTopologyChange?: (topology: TopologyGraph) => void;
}

interface LayoutNode {
  room: TopologyGraphRoom;
  x: number;
  y: number;
  radius: number;
}

const zoneColors: Record<TopologyGraphRoom["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

function layoutNodes(rooms: TopologyGraphRoom[]): LayoutNode[] {
  const centerX = 420;
  const centerY = 280;
  const ringRadius = Math.max(140, rooms.length * 18);

  return rooms.map((room, index) => {
    const angle = (Math.PI * 2 * index) / rooms.length - Math.PI / 2;
    const areaScale = Math.sqrt(Math.max(room.targetAreaSqm, 8));
    return {
      room,
      x: centerX + Math.cos(angle) * ringRadius,
      y: centerY + Math.sin(angle) * ringRadius,
      radius: Math.min(56, Math.max(28, areaScale * 2.4))
    };
  });
}

function edgeKey(from: string, to: string) {
  return [from, to].sort().join("|");
}

export function BubbleDiagramCanvas({ topology, programLabel, onTopologyChange }: BubbleDiagramCanvasProps) {
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (!topology?.rooms.length) {
      setNodePositions({});
      return;
    }

    const layout = layoutNodes(topology.rooms);
    setNodePositions(Object.fromEntries(layout.map((node) => [node.room.id, { x: node.x, y: node.y }])));
    setSelectedIds([]);
  }, [topology?.id, topology?.rooms.length]);

  const nodes = useMemo(() => {
    if (!topology?.rooms.length) {
      return [];
    }

    return topology.rooms.map((room, index) => {
      const fallback = layoutNodes(topology.rooms)[index];
      const position = nodePositions[room.id] ?? { x: fallback.x, y: fallback.y };
      return {
        room,
        x: position.x,
        y: position.y,
        radius: fallback.radius
      };
    });
  }, [topology?.rooms, nodePositions]);

  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.room.id, node])), [nodes]);

  if (!topology?.rooms.length) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-white">Bubble diagram</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Generate a scheme or import a plan to populate topology. Drag bubbles to rearrange and click pairs to toggle
            adjacency.
          </p>
        </div>
      </div>
    );
  }

  function toggleSelection(roomId: string) {
    setSelectedIds((current) => {
      if (current.includes(roomId)) {
        return current.filter((id) => id !== roomId);
      }

      if (current.length === 1) {
        return [current[0], roomId];
      }

      return [roomId];
    });
  }

  function toggleEdge(from: string, to: string) {
    if (!topology || !onTopologyChange) {
      return;
    }

    const key = edgeKey(from, to);
    const existing = topology.edges.find((edge) => edgeKey(edge.from, edge.to) === key);

    const edges: TopologyGraphEdge[] = existing
      ? topology.edges.filter((edge) => edgeKey(edge.from, edge.to) !== key)
      : [...topology.edges, { from, to, relationship: "direct" }];

    onTopologyChange({ ...topology, edges });
    setSelectedIds([]);
  }

  function handleNodePointerDown(roomId: string) {
    setDraggingId(roomId);
    toggleSelection(roomId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!draggingId) {
      return;
    }

    const svg = event.currentTarget;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());

    setNodePositions((current) => ({
      ...current,
      [draggingId]: { x: transformed.x, y: transformed.y }
    }));
  }

  function handlePointerUp() {
    if (selectedIds.length === 2 && onTopologyChange) {
      toggleEdge(selectedIds[0], selectedIds[1]);
    }

    setDraggingId(null);
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{topology.label || "Program bubble"}</h2>
          <p className="mt-1 text-xs text-muted">
            {programLabel ? `${programLabel} · ` : ""}
            Drag bubbles · select two to toggle adjacency · {topology.edges.length} edges
          </p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">{topology.strategy}</span>
      </div>

      <svg
        className="h-[560px] w-full rounded border border-line bg-[#0b1118] touch-none"
        viewBox="0 0 840 560"
        onPointerLeave={() => setDraggingId(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {topology.edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) {
            return null;
          }

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              stroke={edge.relationship === "direct" ? "#5eead4" : "#475569"}
              strokeDasharray={edge.relationship === "separated" ? "6 4" : undefined}
              strokeWidth={edge.relationship === "direct" ? 2 : 1.5}
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          );
        })}

        {nodes.map((node) => {
          const isSelected = selectedIds.includes(node.room.id);

          return (
            <g
              key={node.room.id}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                handleNodePointerDown(node.room.id);
              }}
              style={{ cursor: "grab" }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                fill={`${zoneColors[node.room.zone]}${isSelected ? "66" : "33"}`}
                r={node.radius}
                stroke={isSelected ? "#f8fafc" : zoneColors[node.room.zone]}
                strokeWidth={isSelected ? 3 : 2}
              />
              <text fill="#e2e8f0" fontSize="12" pointerEvents="none" textAnchor="middle" x={node.x} y={node.y - 4}>
                {node.room.name}
              </text>
              <text fill="#94a3b8" fontSize="10" pointerEvents="none" textAnchor="middle" x={node.x} y={node.y + 12}>
                {node.room.targetAreaSqm} sqm
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
