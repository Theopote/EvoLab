"use client";

import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { Point } from "@/lib/project-types";

interface OutlineCanvasProps {
  points: Point[];
  closed: boolean;
  onChange: (points: Point[]) => void;
  onClosedChange: (closed: boolean) => void;
}

const width = 360;
const height = 240;
const scale = 6;

function toModelPoint(clientX: number, clientY: number, rect: DOMRect): Point {
  const x = Math.round(((clientX - rect.left) / rect.width) * width) / scale;
  const y = Math.round(((clientY - rect.top) / rect.height) * height) / scale;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

export function OutlineCanvas({ points, closed, onChange, onClosedChange }: OutlineCanvasProps) {
  function handleCanvasClick(event: React.MouseEvent<SVGSVGElement>) {
    if (closed) {
      return;
    }

    const point = toModelPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    onChange([...points, point]);
  }

  function undo() {
    onClosedChange(false);
    onChange(points.slice(0, -1));
  }

  function clear() {
    onClosedChange(false);
    onChange([]);
  }

  function closeOutline() {
    if (points.length >= 3) {
      onClosedChange(true);
    }
  }

  const svgPoints = points.map(([x, y]) => `${x * scale},${y * scale}`).join(" ");

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Draw Outline</h2>
          <p className="mt-1 text-xs text-muted">Click to place boundary points. Close before generation.</p>
        </div>
        <span className="rounded border border-line px-2 py-1 text-xs text-muted">{points.length} pts</span>
      </div>

      <svg
        className="h-60 w-full cursor-crosshair rounded border border-line bg-[#081018]"
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleCanvasClick}
        onDoubleClick={closeOutline}
        role="img"
        aria-label={`建筑轮廓绘制画布，当前有${points.length}个点${closed ? '，轮廓已闭合' : ''}`}
      >
        <defs>
          <pattern id="outline-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(143,171,190,0.16)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#outline-grid)" />
        {points.length > 1 ? (
          <polyline points={svgPoints} fill="none" stroke="#4fb5c8" strokeWidth="2" strokeLinejoin="round" />
        ) : null}
        {closed && points.length >= 3 ? (
          <polygon points={svgPoints} fill="rgba(79,181,200,0.14)" stroke="#e5edf5" strokeWidth="1.5" />
        ) : null}
        {points.map(([x, y], index) => (
          <g key={`${x}-${y}-${index}`}>
            <circle cx={x * scale} cy={y * scale} r="4" fill="#4fb5c8" />
            <text x={x * scale + 6} y={y * scale - 6} fill="#9fb3c8" fontSize="10">
              {index + 1}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-200 hover:border-accent/60"
          type="button"
          onClick={undo}
          disabled={points.length === 0}
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
        <button
          className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-200 hover:border-accent/60"
          type="button"
          onClick={closeOutline}
          disabled={points.length < 3}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Close
        </button>
        <button
          className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-200 hover:border-danger/60"
          type="button"
          onClick={clear}
          disabled={points.length === 0}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </section>
  );
}
