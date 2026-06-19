"use client";

import { useMemo } from "react";
import type { PlanVersion, Point, VerticalElement } from "@/lib/project-types";
import { buildVerticalAlignmentReport } from "@/lib/vertical-alignment";

interface VerticalSectionViewProps {
  version: PlanVersion;
  activeLevelId?: string;
  className?: string;
}

function isPointPosition(position: Point | Point[]): position is Point {
  return !Array.isArray(position[0]);
}

function collectColumnPositions(elements: VerticalElement[]) {
  return elements
    .filter((element) => element.kind === "column" && isPointPosition(element.position))
    .map((element) => ({
      id: element.id,
      position: element.position as Point
    }));
}

export function VerticalSectionView({ version, activeLevelId, className }: VerticalSectionViewProps) {
  const report = useMemo(() => buildVerticalAlignmentReport(version), [version]);
  const columns = useMemo(
    () => collectColumnPositions(version.verticalElements ?? []),
    [version.verticalElements]
  );

  const levels = useMemo(
    () =>
      [...version.levels].sort(
        (left, right) => (right.floorNumber ?? 0) - (left.floorNumber ?? 0)
      ),
    [version.levels]
  );

  const totalHeight = levels.reduce((sum, level) => sum + level.height, 0) || 1;
  const width = 640;
  const height = 340;
  const leftMargin = 80;
  const stackWidth = 420;
  const baseY = height - 30;
  const scale = (baseY - 40) / totalHeight;

  const issueKeys = new Set(
    report.issues.map((issue) => `${issue.floorId}:${issue.elementId}`)
  );

  let cursorY = baseY;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Vertical section alignment view"
    >
      <title>Vertical section alignment view</title>
      <desc>
        Floors stacked by elevation with column lines; misaligned columns are highlighted in red.
      </desc>

      {levels.map((level) => {
        const slabHeight = Math.max(18, level.height * scale);
        const y = cursorY - slabHeight;
        cursorY = y;
        const isActive = level.id === activeLevelId;
        const isTypical = Boolean(level.standardFloorGroupId && !level.localOverrideRooms);
        const fill = isActive
          ? "rgba(96, 165, 250, 0.28)"
          : isTypical
            ? "rgba(96, 165, 250, 0.16)"
            : level.floorProgram === "ground"
              ? "rgba(250, 204, 21, 0.18)"
              : "rgba(148, 163, 184, 0.12)";

        return (
          <g key={level.id}>
            <rect
              x={leftMargin}
              y={y}
              width={stackWidth}
              height={slabHeight}
              fill={fill}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth={0.75}
            />
            <text
              x={leftMargin - 8}
              y={y + slabHeight / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="rgba(148, 163, 184, 0.9)"
            >
              {level.name}
            </text>
            <text x={leftMargin + 8} y={y + 12} fontSize={9} fill="rgba(226, 232, 240, 0.85)">
              {level.elevation.toFixed(1)} m · {level.height.toFixed(1)} m
            </text>
          </g>
        );
      })}

      {columns.map((column) => {
        const minX = Math.min(...version.outline.map(([x]) => x));
        const maxX = Math.max(...version.outline.map(([x]) => x));
        const span = Math.max(maxX - minX, 1);
        const x = leftMargin + ((column.position[0] - minX) / span) * stackWidth;
        const brokenLevels = levels.filter((level) => issueKeys.has(`${level.id}:${column.id}`));
        const topY = baseY - totalHeight * scale;
        const breakLevel = brokenLevels[0];
        const breakY = breakLevel
          ? (() => {
              let y = baseY;
              for (const level of levels) {
                const slabHeight = Math.max(18, level.height * scale);
                y -= slabHeight;
                if (level.id === breakLevel.id) {
                  return y + slabHeight;
                }
              }
              return topY;
            })()
          : undefined;

        return (
          <g key={column.id}>
            <line
              x1={x}
              y1={baseY}
              x2={x}
              y2={breakY ?? topY}
              stroke="rgba(148, 163, 184, 0.9)"
              strokeWidth={1.5}
            />
            {breakY ? (
              <>
                <line
                  x1={x}
                  y1={breakY}
                  x2={x}
                  y2={topY}
                  stroke="rgba(248, 113, 113, 0.95)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                <circle cx={x} cy={breakY - 6} r={4.5} fill="none" stroke="rgba(248, 113, 113, 0.95)" strokeWidth={1.5} />
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
