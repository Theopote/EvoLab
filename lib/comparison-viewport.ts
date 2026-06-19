import type { ComparisonViewport } from "@/lib/comparison-viewport-types";

export function parseViewBox(viewBox: string): ComparisonViewport | undefined {
  const parts = viewBox.trim().split(/\s+/).map(Number);

  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return undefined;
  }

  const [x, y, width, height] = parts as [number, number, number, number];
  return { x, y, width, height };
}

export function formatViewBox(viewport: ComparisonViewport) {
  return `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`;
}

export function applyRelativePan(
  leader: ComparisonViewport,
  followerBase: ComparisonViewport,
  nextLeader: ComparisonViewport
): ComparisonViewport {
  const dx = (nextLeader.x - leader.x) / leader.width;
  const dy = (nextLeader.y - leader.y) / leader.height;
  const scale = nextLeader.width / leader.width;

  return {
    x: followerBase.x + dx * followerBase.width,
    y: followerBase.y + dy * followerBase.height,
    width: followerBase.width * scale,
    height: followerBase.height * scale
  };
}

export function viewBoxFromVersionBounds(width: number, height: number, padding = 8): ComparisonViewport {
  return {
    x: -padding,
    y: -padding,
    width: width + padding * 2,
    height: height + padding * 2
  };
}
