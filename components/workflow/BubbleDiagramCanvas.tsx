"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { HelpCircle } from "lucide-react";
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
import { SimpleTooltip } from "@/components/ui/Tooltip";

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
  direct: "直接相邻",
  near: "邻近/优选",
  separated: "分离"
};

const relationshipDescriptions: Record<BubbleRelationship, string> = {
  direct: "两个空间必须直接相邻，共享墙体或开口",
  near: "两个空间应该靠近，但不一定直接接触",
  separated: "两个空间应该保持距离，避免相邻"
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
        <div className="max-w-md space-y-4">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-base font-semibold text-white">气泡图</h2>
            <SimpleTooltip title="气泡图用于表示空间之间的拓扑关系和相邻要求">
              <HelpCircle className="h-4 w-4 text-muted" />
            </SimpleTooltip>
          </div>
          <p className="text-sm leading-6 text-muted">
            生成方案或导入平面以填充拓扑关系图
          </p>
          <div className="mt-4 rounded-lg border border-line bg-[#0b1118] p-4 text-left">
            <h3 className="mb-2 text-xs font-semibold text-slate-200">操作说明：</h3>
            <ul className="space-y-1.5 text-xs text-muted">
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span><strong className="text-slate-300">拖拽气泡</strong> - 调整布局位置</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span><strong className="text-slate-300">点击边线</strong> - 循环切换关系类型</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent">•</span>
                <span><strong className="text-slate-300">选择两个气泡</strong> - 创建或编辑连接</span>
              </li>
            </ul>
          </div>
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
          <h2 className="text-base font-semibold text-white">{topology.label || "功能气泡图"}</h2>
          <p className="mt-1 text-xs text-muted">
            {programLabel ? `${programLabel} · ` : ""}
            拖拽气泡调整位置 · 点击边线或选择两个气泡来设置关系：直接相邻 → 邻近 → 分离 → 删除
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted">关系类型：</span>
          {bubbleRelationshipOrder.map((relationship) => {
            const style = edgeStrokeStyle(relationship);
            return (
              <SimpleTooltip
                key={relationship}
                title={relationshipDescriptions[relationship]}
                side="bottom"
              >
                <span className="inline-flex items-center gap-2 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-slate-200 transition-colors">
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
              </SimpleTooltip>
            );
          })}
        </div>
      </div>

      {selectedEdge ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-accent/30 bg-accent/5 px-3 py-2 text-xs">
          <span className="text-slate-200">
            已选择连接: <strong>{topology.rooms.find((room) => room.id === selectedEdge.from)?.name ?? selectedEdge.from}</strong> ↔{" "}
            <strong>{topology.rooms.find((room) => room.id === selectedEdge.to)?.name ?? selectedEdge.to}</strong>
          </span>
          <span className="text-muted">|</span>
          <span className="text-muted">选择关系类型：</span>
          {bubbleRelationshipOrder.map((relationship) => (
            <SimpleTooltip
              key={relationship}
              title={relationshipDescriptions[relationship]}
            >
              <button
                className={`rounded border px-2 py-1 text-xs ${
                  selectedEdge.relationship === relationship
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-line text-muted hover:border-accent/50 hover:text-slate-200"
                }`}
                type="button"
                onClick={() => applyEdgeRelationship(selectedEdge.from, selectedEdge.to, relationship)}
              >
                {relationshipLabels[relationship]}
              </button>
            </SimpleTooltip>
          ))}
          <SimpleTooltip title="删除此连接关系">
            <button
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:border-warning hover:text-warning"
              type="button"
              onClick={() => applyEdgeRelationship(selectedEdge.from, selectedEdge.to, null)}
            >
              删除
            </button>
          </SimpleTooltip>
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
          const isDragging = draggingId === node.room.id;
          const zoneLabels: Record<TopologyGraphRoom["zone"], string> = {
            public: "公共区",
            semi_public: "半公共区",
            private: "私密区",
            service: "服务区",
            circulation: "交通区"
          };

          return (
            <g key={node.room.id}>
              {/* Tooltip container - using SVG title for now as SimpleTooltip won't work in SVG */}
              <title>
                {node.room.name} · {node.room.targetAreaSqm} sqm · {zoneLabels[node.room.zone]}
                {isDragging ? " (拖拽中)" : isSelected ? " (已选中)" : " (点击选择)"}
              </title>
              <circle
                cx={node.x}
                cy={node.y}
                fill={`${zoneColors[node.room.zone]}${isSelected ? "66" : isDragging ? "88" : "33"}`}
                r={node.radius}
                stroke={isSelected ? "#f8fafc" : isDragging ? "#f59e0b" : zoneColors[node.room.zone]}
                strokeWidth={isSelected ? 3 : isDragging ? 2.5 : 2}
                onPointerDown={(event) => handleNodePointerDown(node.room.id, event)}
                style={{ cursor: isDragging ? "grabbing" : "grab", transition: "all 0.15s ease" }}
              />
              <text
                fill={isSelected ? "#ffffff" : "#e2e8f0"}
                fontSize="12"
                fontWeight={isSelected ? "600" : "400"}
                pointerEvents="none"
                textAnchor="middle"
                x={node.x}
                y={node.y - 4}
              >
                {node.room.name}
              </text>
              <text fill="#94a3b8" fontSize="10" pointerEvents="none" textAnchor="middle" x={node.x} y={node.y + 12}>
                {node.room.targetAreaSqm} m²
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
