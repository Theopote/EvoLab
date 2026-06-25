"use client";

import { useMemo } from "react";
import type { TopologyGraph, TopologyGraphRoom } from "@/lib/project-types";

interface BubbleDiagramCanvasProps {
  topology?: TopologyGraph;
  programLabel?: string;
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
  if (rooms.length === 0) {
    return [];
  }

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

export function BubbleDiagramCanvas({ topology, programLabel }: BubbleDiagramCanvasProps) {
  const nodes = useMemo(() => layoutNodes(topology?.rooms ?? []), [topology?.rooms]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.room.id, node])), [nodes]);

  if (!topology?.rooms.length) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-md">
          <h2 className="text-base font-semibold text-white">Bubble diagram</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Generate a scheme or import a plan to populate topology. The bubble view reads from the active version
            metadata graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{topology.label || "Program bubble"}</h2>
          <p className="mt-1 text-xs text-muted">
            {programLabel ? `${programLabel} · ` : ""}
            {topology.rooms.length} spaces · {topology.edges.length} adjacencies
          </p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">{topology.strategy}</span>
      </div>

      <svg className="h-[560px] w-full rounded border border-line bg-[#0b1118]" viewBox="0 0 840 560">
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

        {nodes.map((node) => (
          <g key={node.room.id}>
            <circle
              cx={node.x}
              cy={node.y}
              fill={`${zoneColors[node.room.zone]}33`}
              r={node.radius}
              stroke={zoneColors[node.room.zone]}
              strokeWidth={2}
            />
            <text fill="#e2e8f0" fontSize="12" textAnchor="middle" x={node.x} y={node.y - 4}>
              {node.room.name}
            </text>
            <text fill="#94a3b8" fontSize="10" textAnchor="middle" x={node.x} y={node.y + 12}>
              {node.room.targetAreaSqm} sqm
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}
