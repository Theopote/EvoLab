import { computeAnalysis } from "@/lib/analysis-engine";
import type { PlanVersion, Point, Room } from "@/lib/project-types";
import type { EnvironmentSurrogate } from "@/lib/site-types";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function polygonPoints(points: Array<[number, number]>) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function roomBounds(room: Room) {
  return room.polygon.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function isoFace(x: number, y: number, width: number, height: number, lift: number) {
  const dx = lift * 0.62;
  const dy = -lift * 0.88;
  return {
    top: `${x + dx},${y + dy} ${x + width + dx},${y + dy} ${x + width + dx},${y + height + dy} ${x + dx},${y + height + dy}`,
    front: `${x},${y + height} ${x + width},${y + height} ${x + width + dx},${y + height + dy} ${x + dx},${y + height + dy}`,
    side: `${x + width},${y} ${x + width},${y + height} ${x + width + dx},${y + height + dy} ${x + width + dx},${y + dy}`
  };
}

const zoneColors: Record<Room["zone"], { top: string; side: string }> = {
  public: { top: "rgba(79,181,200,0.55)", side: "rgba(79,181,200,0.28)" },
  semi_public: { top: "rgba(132,204,22,0.48)", side: "rgba(132,204,22,0.24)" },
  private: { top: "rgba(167,139,250,0.48)", side: "rgba(167,139,250,0.24)" },
  service: { top: "rgba(230,162,60,0.52)", side: "rgba(230,162,60,0.26)" },
  circulation: { top: "rgba(148,163,184,0.42)", side: "rgba(148,163,184,0.2)" }
};

export function renderIsometricDiagram(version: PlanVersion) {
  const padding = 14;
  const width = version.overallBounds.width + padding * 2 + 24;
  const height = version.overallBounds.height + padding * 2 + 28;
  const shapes = [...version.rooms]
    .sort((a, b) => roomBounds(a).minY - roomBounds(b).minY)
    .map((room) => {
      const bounds = roomBounds(room);
      const lift = Math.max(2.8, room.ceilingHeight * 0.95);
      const faces = isoFace(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, lift);
      const colors = zoneColors[room.zone];
      const labelX = (bounds.minX + bounds.maxX) / 2 + lift * 0.35;
      const labelY = (bounds.minY + bounds.maxY) / 2 - lift * 0.75;

      return `
        <g>
          <polygon points="${faces.front}" fill="${colors.side}" stroke="#94a3b8" stroke-width="0.2" />
          <polygon points="${faces.side}" fill="${colors.side}" stroke="#94a3b8" stroke-width="0.2" />
          <polygon points="${faces.top}" fill="${colors.top}" stroke="#e2e8f0" stroke-width="0.28" />
          <text x="${labelX}" y="${labelY}" fill="#f8fafc" font-size="1.2" text-anchor="middle">${escapeXml(room.name)}</text>
        </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding - 10} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.03)" stroke="#64748b" stroke-width="0.35" />
    ${shapes}
  </svg>`;
}

export function renderExplodedDiagram(version: PlanVersion) {
  const centerX = version.overallBounds.width / 2;
  const centerY = version.overallBounds.height / 2;
  const padding = 18;
  const width = version.overallBounds.width + padding * 2 + 40;
  const height = version.overallBounds.height + padding * 2 + 40;

  const shapes = version.rooms.map((room) => {
    const bounds = roomBounds(room);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const vectorX = (cx - centerX) * 0.22;
    const vectorY = (cy - centerY) * 0.22;
    const shifted = room.polygon.map(([x, y]) => [x + vectorX, y + vectorY] as [number, number]);
    const labelX = cx + vectorX;
    const labelY = cy + vectorY;

    return `
      <g>
        <polygon points="${polygonPoints(shifted)}" fill="${zoneColors[room.zone].top}" stroke="#e2e8f0" stroke-width="0.3" />
        <line x1="${cx}" y1="${cy}" x2="${labelX}" y2="${labelY - 2.4}" stroke="#4fb5c8" stroke-width="0.15" />
        <text x="${labelX}" y="${labelY - 3}" fill="#e2e8f0" font-size="1.05" text-anchor="middle">${escapeXml(room.name)}</text>
        <text x="${labelX}" y="${labelY - 1.5}" fill="#94a3b8" font-size="0.85" text-anchor="middle">${escapeXml(room.zone)} · ${room.areaSqm.toFixed(0)} sqm</text>
      </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    <polygon points="${polygonPoints(version.outline)}" fill="none" stroke="#475569" stroke-dasharray="1 1" stroke-width="0.3" />
    ${shapes.join("\n")}
  </svg>`;
}

export function renderFlowDiagram(version: PlanVersion, projectType = "healthcare", legendLabel?: string) {
  const analysis = computeAnalysis(version, ["primary_flow", "staff_flow", "egress_path", "sightline"], {
    projectType
  });
  const padding = 10;
  const width = version.overallBounds.width + padding * 2;
  const height = version.overallBounds.height + padding * 2;

  const paths = [
    analysis.primaryFlow ?? analysis.patientFlow
      ? `<polyline points="${(analysis.primaryFlow ?? analysis.patientFlow)!.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#38bdf8" stroke-width="0.55" marker-end="url(#arrow-flow)" />`
      : "",
    analysis.staffFlow
      ? `<polyline points="${analysis.staffFlow.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#a78bfa" stroke-width="0.5" />`
      : "",
    analysis.sightlineCone
      ? `<polygon points="${analysis.sightlineCone.map((p) => p.join(",")).join(" ")}" fill="rgba(251,113,133,0.14)" stroke="#fb7185" stroke-width="0.3" />`
      : ""
  ].join("\n");

  const egress = analysis.egressPaths
    .slice(0, 8)
    .map(
      (path) =>
        `<polyline points="${path.points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#22c55e" stroke-opacity="0.7" stroke-width="0.35" />`
    )
    .join("\n");

  const rooms = version.rooms
    .map((room) => {
      const bounds = roomBounds(room);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      return `<circle cx="${cx}" cy="${cy}" r="0.7" fill="#94a3b8" />`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <defs>
      <marker id="arrow-flow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <path d="M0,0 L5,2.5 L0,5 Z" fill="#38bdf8" />
      </marker>
    </defs>
    <rect width="100%" height="100%" fill="#081018" />
    <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.02)" stroke="#64748b" stroke-width="0.3" />
    ${rooms}
    ${paths}
    ${egress}
    <text x="2" y="-4" fill="#94a3b8" font-size="1.4">${escapeXml(legendLabel ?? "Primary flow · Staff flow · Sightline · Egress")}</text>
  </svg>`;
}

export function renderZoneDiagram(version: PlanVersion) {
  const padding = 8;
  const width = version.overallBounds.width + padding * 2;
  const height = version.overallBounds.height + padding * 2;
  const rooms = version.rooms
    .map((room) => {
      const bounds = roomBounds(room);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      return `
        <g>
          <polygon points="${polygonPoints(room.polygon)}" fill="${zoneColors[room.zone].top}" stroke="#e2e8f0" stroke-width="0.25" />
          <text x="${cx}" y="${cy}" fill="#f8fafc" font-size="1.2" text-anchor="middle">${escapeXml(room.zone)}</text>
        </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    ${rooms}
  </svg>`;
}

function environmentColor(channel: "sun" | "wind", value: number) {
  if (channel === "sun") {
    const normalized = Math.max(0, Math.min(1, (value - 1) / 7));
    const red = Math.round(30 + normalized * 220);
    const green = Math.round(60 + normalized * 140);
    return `rgba(${red}, ${green}, 80, 0.78)`;
  }

  const normalized = Math.max(0, Math.min(1, value));
  const blue = Math.round(80 + normalized * 120);
  return `rgba(56, 189, ${blue}, 0.72)`;
}

export function renderEnvironmentDiagram(surrogate: EnvironmentSurrogate, outline: Point[]) {
  const padding = 8;
  const minX = Math.min(...outline.map(([x]) => x));
  const minY = Math.min(...outline.map(([, y]) => y));
  const maxX = Math.max(...outline.map(([x]) => x));
  const maxY = Math.max(...outline.map(([, y]) => y));
  const width = maxX - minX + padding * 2;
  const height = maxY - minY + padding * 2;
  const cellWidth = width / surrogate.gridSize;
  const cellHeight = height / surrogate.gridSize;

  const sunCells = surrogate.cells
    .map((cell) => {
      const x = cell.x - minX - cellWidth / 2;
      const y = cell.y - minY - cellHeight / 2;
      return `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${environmentColor("sun", cell.sunHours)}" />`;
    })
    .join("\n");

  const windCells = surrogate.cells
    .map((cell) => {
      const x = cell.x - minX - cellWidth / 2;
      const y = cell.y - minY - cellHeight / 2;
      return `<rect x="${x}" y="${y}" width="${cellWidth * 0.42}" height="${cellHeight * 0.42}" fill="${environmentColor("wind", cell.windShelter)}" opacity="0.9" />`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    ${sunCells}
    <polygon points="${polygonPoints(outline)}" fill="rgba(255,255,255,0.03)" stroke="#e2e8f0" stroke-width="0.35" />
    ${windCells}
    <text x="2" y="-4" fill="#94a3b8" font-size="1.3">Sun proxy (field) · Wind shelter (inset squares)</text>
  </svg>`;
}

export function renderEvolutionDiagram(version: PlanVersion) {
  const padding = 10;
  const width = version.overallBounds.width;
  const height = version.overallBounds.height;
  const panelWidth = width + padding * 2;
  const panelGap = 12;
  const totalWidth = panelWidth * 3 + panelGap * 2;
  const totalHeight = height + padding * 2 + 16;

  const topologyRooms = version.rooms.map((room, index) => {
    const bounds = roomBounds(room);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const radius = Math.max(1.2, Math.sqrt(room.areaSqm) * 0.22);
    const offsetX = (index % 3) * 0.4;
    return `<circle cx="${cx + offsetX}" cy="${cy}" r="${radius}" fill="${zoneColors[room.zone].top}" stroke="#94a3b8" stroke-width="0.2" />`;
  });

  const geometryRooms = version.rooms
    .map(
      (room) =>
        `<polygon points="${polygonPoints(room.polygon)}" fill="${zoneColors[room.zone].side}" stroke="#cbd5e1" stroke-width="0.25" />`
    )
    .join("\n");

  const refinedRooms = version.rooms
    .map((room) => {
      const bounds = roomBounds(room);
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      return `
        <g>
          <polygon points="${polygonPoints(room.polygon)}" fill="${zoneColors[room.zone].top}" stroke="#e2e8f0" stroke-width="0.28" />
          <text x="${cx}" y="${cy}" fill="#f8fafc" font-size="0.95" text-anchor="middle">${escapeXml(room.name)}</text>
        </g>`;
    })
    .join("\n");

  function panel(offsetX: number, label: string, content: string) {
    return `
      <g transform="translate(${offsetX} 0)">
        <rect x="${-padding}" y="${-padding - 8}" width="${panelWidth}" height="${totalHeight}" fill="rgba(15,23,42,0.35)" stroke="#334155" stroke-width="0.25" rx="1.5" />
        <text x="0" y="${-padding - 2}" fill="#94a3b8" font-size="1.2">${label}</text>
        <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.02)" stroke="#475569" stroke-width="0.25" />
        ${content}
      </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding - 10} ${totalWidth} ${totalHeight + 8}" role="img" class="evolution-diagram">
    <rect width="100%" height="100%" fill="#081018" />
    ${panel(0, "1 · Topology", topologyRooms.join("\n"))}
    ${panel(panelWidth + panelGap, "2 · Geometry", geometryRooms)}
    ${panel((panelWidth + panelGap) * 2, "3 · Refinement", refinedRooms)}
  </svg>`;
}

const topologyZoneColors: Record<string, string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

const facadeEdgeColors: Record<string, string> = {
  curtain_wall: "#38bdf8",
  punched_window: "#34d399",
  solid: "#94a3b8",
  mixed: "#fbbf24"
};

const mepSystemColors: Record<string, string> = {
  hvac: "#5eead4",
  plumbing_supply: "#38bdf8",
  plumbing_drain: "#60a5fa",
  electrical: "#fbbf24",
  elv: "#a78bfa",
  fire: "#f87171"
};

export function renderTopologyDiagram(graph: import("@/lib/project-types").TopologyGraph) {
  const centerX = 420;
  const centerY = 280;
  const ringRadius = Math.max(140, graph.rooms.length * 18);
  const nodes = graph.rooms.map((room, index) => {
    const angle = (Math.PI * 2 * index) / graph.rooms.length - Math.PI / 2;
    const areaScale = Math.sqrt(Math.max(room.targetAreaSqm, 8));
    return {
      room,
      x: centerX + Math.cos(angle) * ringRadius,
      y: centerY + Math.sin(angle) * ringRadius,
      radius: Math.min(56, Math.max(28, areaScale * 2.4))
    };
  });
  const nodeById = new Map(nodes.map((node) => [node.room.id, node]));

  const edges = graph.edges
    .map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) {
        return "";
      }

      const stroke =
        edge.relationship === "direct" ? "#e2e8f0" : edge.relationship === "near" ? "#94a3b8" : "#475569";
      const dash = edge.relationship === "separated" ? ' stroke-dasharray="4 3"' : "";

      return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${stroke}" stroke-width="1.2"${dash} />`;
    })
    .join("\n");

  const bubbles = nodes
    .map(({ room, x, y, radius }) => {
      const fill = topologyZoneColors[room.zone] ?? "#94a3b8";
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" fill-opacity="0.72" stroke="#e2e8f0" stroke-width="1" />
          <text x="${x}" y="${y - 4}" fill="#f8fafc" font-size="11" text-anchor="middle">${escapeXml(room.name)}</text>
          <text x="${x}" y="${y + 10}" fill="#cbd5e1" font-size="9" text-anchor="middle">${room.targetAreaSqm} sqm</text>
        </g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 560" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    ${edges}
    ${bubbles}
    <text x="16" y="24" fill="#94a3b8" font-size="13">${escapeXml(graph.label)} · ${escapeXml(graph.strategy)}</text>
  </svg>`;
}

export function renderFacadeDiagram(
  version: PlanVersion,
  facadeEnvelope?: import("@/lib/building-domain").FacadeEnvelope
) {
  const padding = 10;
  const width = version.overallBounds.width + padding * 2;
  const height = version.overallBounds.height + padding * 2;
  const { width: planWidth, height: planHeight } = version.overallBounds;
  const edgeSegments = {
    north: [
      [0, 0],
      [planWidth, 0]
    ] as const,
    south: [
      [0, planHeight],
      [planWidth, planHeight]
    ] as const,
    east: [
      [planWidth, 0],
      [planWidth, planHeight]
    ] as const,
    west: [
      [0, 0],
      [0, planHeight]
    ] as const
  };

  const zones = facadeEnvelope?.zones ?? [];
  const facadeLines = zones
    .map((zone) => {
      const segment = edgeSegments[zone.edge];
      const color = facadeEdgeColors[zone.strategy] ?? "#94a3b8";
      return `<line x1="${segment[0][0]}" y1="${segment[0][1]}" x2="${segment[1][0]}" y2="${segment[1][1]}" stroke="${color}" stroke-linecap="round" stroke-width="1.4" />`;
    })
    .join("\n");

  const rooms = version.rooms
    .map(
      (room) =>
        `<polygon points="${polygonPoints(room.polygon)}" fill="rgba(255,255,255,0.03)" stroke="#475569" stroke-width="0.25" />`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.02)" stroke="#64748b" stroke-width="0.35" />
    ${rooms}
    ${facadeLines}
    <text x="2" y="-4" fill="#94a3b8" font-size="1.3">Facade strategy by perimeter edge</text>
  </svg>`;
}

export function renderSystemsDiagram(version: PlanVersion, mep?: import("@/lib/project-types").MepLayout) {
  const padding = 10;
  const width = version.overallBounds.width + padding * 2;
  const height = version.overallBounds.height + padding * 2;

  const rooms = version.rooms
    .map((room) => {
      const isService = room.zone === "service" || room.type === "shaft" || room.type === "equipment_room";
      return isService
        ? `<polygon points="${polygonPoints(room.polygon)}" fill="rgba(230,162,60,0.22)" stroke="#e6a23c" stroke-width="0.35" />`
        : `<polygon points="${polygonPoints(room.polygon)}" fill="rgba(255,255,255,0.02)" stroke="#475569" stroke-width="0.2" />`;
    })
    .join("\n");

  const routes = (mep?.routes ?? [])
    .map(
      (route, index) =>
        `<polyline points="${route.path.map((point) => point.join(",")).join(" ")}" fill="none" stroke="${mepSystemColors[route.system] ?? "#94a3b8"}" stroke-width="${0.55 + index * 0.01}" />`
    )
    .join("\n");

  const shafts = (mep?.shafts ?? [])
    .map(
      (shaft) =>
        `<circle cx="${shaft.position[0]}" cy="${shaft.position[1]}" r="1.2" fill="#f97316" stroke="#fff7ed" stroke-width="0.2" />`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-padding} ${-padding} ${width} ${height}" role="img">
    <rect width="100%" height="100%" fill="#081018" />
    <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.02)" stroke="#64748b" stroke-width="0.35" />
    ${rooms}
    ${routes}
    ${shafts}
    <text x="2" y="-4" fill="#94a3b8" font-size="1.3">MEP routes and shafts on plan</text>
  </svg>`;
}
