import { initialProjectData } from "@/lib/evolab-data";
import type {
  AnalysisLayerId,
  CopilotFinding,
  MepLayout,
  MepSystemType,
  PlanVersion,
  Point
} from "@/lib/project-types";

const baseVersion = initialProjectData.versions[0];

function shiftPolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function withScores(version: PlanVersion, index: number): PlanVersion {
  return {
    ...version,
    scores: {
      areaEfficiency: 82 + index * 3,
      circulationScore: 76 + index * 4,
      daylightScore: 80 + index * 2,
      mepAlignmentScore: 74 + index * 5,
      riskCount: Math.max(0, 3 - index)
    }
  };
}

export function createMockPlanVersions(outline?: Point[], projectType = "healthcare"): PlanVersion[] {
  const sourceOutline = outline && outline.length >= 3 ? outline : baseVersion.outline;
  const bounds = sourceOutline.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return ["集中核心筒", "双走廊", "服务带"].map((strategy, index) => {
    const offset = index * 1.8;
    return withScores(
      {
        ...baseVersion,
        id: `mock-${projectType}-${index + 1}`,
        label: `方案 ${String.fromCharCode(65 + index)} / ${strategy}`,
        createdAt: new Date().toISOString(),
        outline: sourceOutline,
        overallBounds: {
          width: Math.max(1, bounds.maxX - bounds.minX),
          height: Math.max(1, bounds.maxY - bounds.minY)
        },
        rooms: baseVersion.rooms.map((room) => ({
          ...room,
          id: `${room.id}-v${index + 1}`,
          polygon: index === 0 ? room.polygon : shiftPolygon(room.polygon, offset, index % 2 === 0 ? 0 : -offset),
          areaSqm: Math.round(room.areaSqm * (1 + index * 0.035))
        }))
      },
      index
    );
  });
}

export function createMockAnalyzedVersion(): { version: PlanVersion; confidence: number; warnings: string[] } {
  return {
    version: {
      ...baseVersion,
      id: "analyzed-plan-001",
      label: "识别方案 / 图纸导入",
      createdAt: new Date().toISOString()
    },
    confidence: 0.78,
    warnings: ["未提供真实图纸识别结果，当前返回 EvoLab mock 结构化平面。", "门窗和文字标注置信度为示例值。"]
  };
}

export function createMockModifiedVersion(currentVersion: PlanVersion, userRequest: string) {
  const shouldMoveCore = /核心|core|北/.test(userRequest);
  const version: PlanVersion = {
    ...currentVersion,
    id: `${currentVersion.id}-mod-${Date.now()}`,
    label: `${currentVersion.label} / Copilot 修改`,
    createdAt: new Date().toISOString(),
    parentVersionId: currentVersion.id,
    rooms: currentVersion.rooms.map((room) => {
      if (shouldMoveCore && (room.type === "elevator" || room.type === "stair" || room.type === "shaft")) {
        return {
          ...room,
          polygon: shiftPolygon(room.polygon, 0, -4)
        };
      }

      return room;
    }),
    scores: {
      areaEfficiency: Math.min(100, (currentVersion.scores?.areaEfficiency ?? 80) + 1),
      circulationScore: Math.min(100, (currentVersion.scores?.circulationScore ?? 75) + 4),
      daylightScore: currentVersion.scores?.daylightScore ?? 80,
      mepAlignmentScore: Math.min(100, (currentVersion.scores?.mepAlignmentScore ?? 72) + 3),
      riskCount: Math.max(0, (currentVersion.scores?.riskCount ?? 2) - 1)
    }
  };

  const findings: CopilotFinding[] = [
    {
      id: "finding-egress",
      tone: "success",
      text: "已根据请求生成完整可编辑方案版本。",
      sub: "平面、模型、分析与算量模块可继续共享此 PlanVersion。",
      actions: [{ id: "recalculate-areas", label: "重新计算面积" }]
    },
    {
      id: "finding-risk",
      tone: version.scores?.riskCount ? "warning" : "success",
      text: version.scores?.riskCount ? "仍有少量规范风险需要后续校核。" : "当前 mock 规则未发现高风险项。",
      actions: [{ id: "optimize-egress", label: "优化疏散" }]
    }
  ];

  return { version, findings };
}

export function createMockMep(version: PlanVersion): { mep: MepLayout; findings: CopilotFinding[] } {
  const shaftRooms = version.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const corridor = version.rooms.find((room) => room.type === "corridor");
  const shaftPoint: Point = shaftRooms[0]?.polygon[0] ?? [version.overallBounds.width * 0.72, version.overallBounds.height * 0.5];
  const trunkStart: Point = corridor?.polygon[0] ?? [10, 10];
  const systems: MepSystemType[] = ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "elv", "fire"];

  return {
    mep: {
      shafts: [
        {
          id: "mep-shaft-01",
          position: shaftPoint,
          systems
        }
      ],
      routes: systems.map((system, index) => ({
        id: `route-${system}`,
        system,
        path: [
          [trunkStart[0], trunkStart[1] + index],
          [shaftPoint[0], trunkStart[1] + index],
          shaftPoint
        ],
        connectsRoomIds: version.rooms
          .filter((room) => room.needsPlumbing || room.type === "equipment_room" || room.type === "shaft")
          .map((room) => room.id)
      }))
    },
    findings: [
      {
        id: "mep-alignment",
        tone: "info",
        text: "已生成概念级 MEP 竖井和主干路由。",
        sub: "优先沿走廊布置主干，并连接设备房、管井和需给排水房间。"
      }
    ]
  };
}

export function createMockDiagram(layers: AnalysisLayerId[]) {
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420"><rect width="720" height="420" fill="#0c1117"/><text x="32" y="48" fill="#9fb3c8" font-family="Arial" font-size="22">EvoLab analysis overlay</text></svg>`,
    overlays: {
      layers,
      rooms: baseVersion.rooms.map((room) => ({
        roomId: room.id,
        zone: room.zone,
        polygon: room.polygon
      }))
    }
  };
}
