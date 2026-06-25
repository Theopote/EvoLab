"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { TopologyGraph, TopologyGraphEdge, TopologyGraphRoom } from "@/lib/project-types";
import {
  bubbleRelationshipOrder,
  cycleBubbleRelationship,
  edgePairKey,
  edgeStrokeStyle,
  findEdge,
  removeBubbleEdge,
  upsertBubbleEdge,
  type BubbleRelationship
} from "@/lib/bubble-topology";

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

const relationshipLabels: Record<BubbleRelationship, string> = {
  direct: "Direct adjacency",
  near: "Near / preferred",
  separated: "Separated"
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

export function BubbleDiagramCanvas({ topology, programLabel, onTopologyChange }: BubbleDiagramCanvasProps) {
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const movedDuringDrag = useRef(false);

  useEffect(() => {
    if (!topology?.rooms.length) {
      setNodePositions({});
      return;
    }

    const layout = layoutNodes(topology.rooms);
    setNodePositions(Object.fromEntries(layout.map((node) => [node.room.id, { x: node.x, y: node.y }])));
    setSelectedIds([]);
    setSelectedEdgeKey(null);
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

  const selectedEdge = useMemo(() => {
    if (!topology || !selectedEdgeKey) {
      return null;
    }

    return topology.edges.find((edge) => edgePairKey(edge.from, edge.to) === selectedEdgeKey) ?? null;
  }, [selectedEdgeKey, topology]);

  if (!topology?.rooms.length) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-white">Bubble diagram</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Generate a scheme or import a plan to populate topology. Drag bubbles, click edges to cycle relationship
            types, or select two bubbles to connect them.
          </p>
        </div>
      </div>
    );
  }

  function applyEdgeRelationship(from: string, to: string, relationship: BubbleRelationship | null) {
    if (!topology || !onTopologyChange) {
      return;
    }

    const edges: TopologyGraphEdge[] = relationship
      ? upsertBubbleEdge(topology.edges, from, to, relationship)
      : removeBubbleEdge(topology.edges, from, to);

    onTopologyChange({ ...topology, edges });
    setSelectedEdgeKey(relationship ? edgePairKey(from, to) : null);
  }

  function cycleEdge(from: string, to: string) {
    if (!topology) {
      return;
    }

    const existing = findEdge(topology.edges, from, to);
    applyEdgeRelationship(from, to, cycleBubbleRelationship(existing?.relationship));
  }

  function handleNodePointerDown(roomId: string, event: PointerEvent<SVGCircleElement>) {
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    movedDuringDrag.current = false;
    setDraggingId(roomId);
    setSelectedEdgeKey(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerUp(roomId: string) {
    if (movedDuringDrag.current) {
      return;
    }

    setSelectedIds((current) => {
      if (current.length === 1 && current[0] !== roomId) {
        cycleEdge(current[0], roomId);
        return [];
      }

      if (current.includes(roomId)) {
        return current.filter((id) => id !== roomId);
      }

      return [roomId];
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!draggingId || !dragOrigin.current) {
      return;
    }

    const distance = Math.hypot(event.clientX - dragOrigin.current.x, event.clientY - dragOrigin.current.y);
    if (distance > 4) {
      movedDuringDrag.current = true;
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
    if (draggingId) {
      handleNodePointerUp(draggingId);
    }

    setDraggingId(null);
    dragOrigin.current = null;
    movedDuringDrag.current = false;
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{topology.label || "Program bubble"}</h2>
          <p className="mt-1 text-xs text-muted">
            {programLabel ? `${programLabel} · ` : ""}
            Drag bubbles · click edge or pick two bubbles to cycle direct → near → separated → remove
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bubbleRelationshipOrder.map((relationship) => {
            const style = edgeStrokeStyle(relationship);
            return (
              <span className="inline-flex items-center gap-2 rounded border border-line px-2 py-1 text-[11px] text-muted" key={relationship}>
                <svg aria-hidden className="h-3 w-8" viewBox="0 0 32 8">
                  <line
                    stroke={style.stroke}
                    strokeDasharray={style.strokeDasharray}
                    strokeWidth={style.strokeWidth}
                    x1="0"
                    x2="32"
                    y1="4"
                    y2="4"
                  />
                </svg>
                {relationshipLabels[relationship]}
              </span>
            );
          })}
        </div>
      </div>

      {selectedEdge ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <span className="text-slate-200">
            Selected edge: {topology.rooms.find((room) => room.id === selectedEdge.from)?.name ?? selectedEdge.from} ↔{" "}
            {topology.rooms.find((room) => room.id === selectedEdge.to)?.name ?? selectedEdge.to}
          </span>
          {bubbleRelationshipOrder.map((relationship) => (
            <button
              className={`rounded border px-2 py-1 ${
                selectedEdge.relationship === relationship
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line text-muted hover:border-accent/50"
              }`}
              key={relationship}
              type="button"
              onClick={() => applyEdgeRelationship(selectedEdge.from, selectedEdge.to, relationship)}
            >
              {relationship}
            </button>
          ))}
          <button
            className="rounded border border-line px-2 py-1 text-muted hover:border-warning hover:text-warning"
            type="button"
            onClick={() => applyEdgeRelationship(selectedEdge.from, selectedEdge.to, null)}
          >
            Remove
          </button>
        </div>
      ) : null}

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

          const style = edgeStrokeStyle(edge.relationship);
          const key = edgePairKey(edge.from, edge.to);

          return (
            <g key={key}>
              <line
                stroke="transparent"
                strokeWidth={16}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedEdgeKey(key);
                  setSelectedIds([]);
                  cycleEdge(edge.from, edge.to);
                }}
              />
              <line
                pointerEvents="none"
                stroke={style.stroke}
                strokeDasharray={style.strokeDasharray}
                strokeWidth={style.strokeWidth}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
            </g>
          );
        })}

        {nodes.map((node) => {
          const isSelected = selectedIds.includes(node.room.id);

          return (
            <g key={node.room.id}>
              <circle
                cx={node.x}
                cy={node.y}
                fill={`${zoneColors[node.room.zone]}${isSelected ? "66" : "33"}`}
                r={node.radius}
                stroke={isSelected ? "#f8fafc" : zoneColors[node.room.zone]}
                strokeWidth={isSelected ? 3 : 2}
                onPointerDown={(event) => handleNodePointerDown(node.room.id, event)}
                style={{ cursor: "grab" }}
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
