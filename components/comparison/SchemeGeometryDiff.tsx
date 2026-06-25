"use client";

import { useMemo } from "react";
import { getViewBox, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { RoomChangeSummary } from "@/lib/plan-change-diff";
import type { PlanVersion } from "@/lib/project-types";

interface SchemeGeometryDiffProps {
  baseVersion: PlanVersion;
  previewVersion: PlanVersion;
  changes: RoomChangeSummary;
  highlightRoomIds?: string[];
  focusedRoomIds?: string[];
  reviewRoomIds?: string[];
  className?: string;
  heightClassName?: string;
}

export function SchemeGeometryDiff({
  baseVersion,
  previewVersion,
  changes,
  highlightRoomIds = [],
  focusedRoomIds = [],
  reviewRoomIds = [],
  className,
  heightClassName = "h-48"
}: SchemeGeometryDiffProps) {
  const highlight = useMemo(() => new Set(highlightRoomIds), [highlightRoomIds]);
  const focused = useMemo(() => new Set(focusedRoomIds), [focusedRoomIds]);
  const review = useMemo(() => new Set(reviewRoomIds), [reviewRoomIds]);

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400/80" />
          modified {changes.modified.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-sky-400/80" />
          added {changes.added.length}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-rose-400/70" />
          removed {changes.removed.length}
        </span>
      </div>

      <svg
        className={`${heightClassName} w-full`}
        viewBox={getViewBox(previewVersion, 4)}
        role="img"
        aria-label="Scheme geometry diff"
      >
        <polygon
          fill="rgba(255,255,255,0.02)"
          points={polygonPoints(baseVersion.outline)}
          stroke="rgba(216,237,245,0.35)"
          strokeWidth="0.2"
        />

        {baseVersion.rooms.map((room) => {
          if (!changes.removed.includes(room.id)) {
            return null;
          }

          return (
            <polygon
              key={`removed-${room.id}`}
              fill="rgba(244,63,94,0.18)"
              points={polygonPoints(room.polygon)}
              stroke="#f43f5e"
              strokeDasharray="0.6 0.4"
              strokeWidth="0.22"
            />
          );
        })}

        {previewVersion.rooms.map((room) => {
          const isAdded = changes.added.includes(room.id);
          const isModified = changes.modified.includes(room.id);
          const isFocused = focused.has(room.id);
          const isReview = review.has(room.id);
          const isHighlighted = highlight.has(room.id) || isFocused || isReview;

          if (!isAdded && !isModified && !isHighlighted) {
            return (
              <polygon
                key={room.id}
                fill="rgba(148,163,184,0.08)"
                points={polygonPoints(room.polygon)}
                stroke="rgba(148,163,184,0.25)"
                strokeWidth="0.12"
              />
            );
          }

          const fill = isReview
            ? "rgba(251,146,60,0.18)"
            : isAdded
              ? "rgba(56,189,248,0.28)"
              : isFocused
                ? "rgba(52,211,153,0.42)"
                : "rgba(52,211,153,0.24)";
          const stroke = isReview ? "#fb923c" : isAdded ? "#38bdf8" : isFocused ? "#34d399" : "#10b981";

          return (
            <g key={room.id}>
              <polygon
                fill={fill}
                points={polygonPoints(room.polygon)}
                stroke={stroke}
                strokeDasharray={isReview ? "0.7 0.4" : undefined}
                strokeWidth={isFocused || isReview ? "0.34" : "0.22"}
              />
              <text
                fill="#e2e8f0"
                fontSize="1.4"
                textAnchor="middle"
                x={centroid(room.polygon)[0]}
                y={centroid(room.polygon)[1]}
              >
                {room.name.split(" ")[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function centroid(polygon: [number, number][]) {
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length] as [number, number];
}
