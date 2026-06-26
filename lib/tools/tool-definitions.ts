import type { LucideIcon } from "lucide-react";
import {
  Box,
  Building2,
  Cpu,
  Layers,
  LayoutGrid,
  Map,
  Paintbrush,
  Presentation,
  ScanLine,
  Sofa
} from "lucide-react";
import type { WorkspaceTab } from "@/lib/project-types";

export type ToolCategory =
  | "import"
  | "site"
  | "scheme"
  | "interior"
  | "presentation"
  | "analysis"
  | "structure"
  | "mep";

export type ToolStatus = "available" | "coming-soon";

export interface ToolDefinition {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  category: ToolCategory;
  icon: LucideIcon;
  status: ToolStatus;
  /** Optional workspace tab to open when launching from toolbox into project context */
  workspaceTab?: WorkspaceTab;
}

export const toolCategoryLabels: Record<ToolCategory, string> = {
  import: "导入识别",
  site: "场地",
  scheme: "方案",
  interior: "室内",
  presentation: "汇报",
  analysis: "分析",
  structure: "结构",
  mep: "机电"
};

export const toolDefinitions: ToolDefinition[] = [
  {
    id: "trace-to-cad",
    name: "Trace to CAD",
    nameZh: "扫描图转 CAD",
    description: "Convert scans, photos, or PDFs into editable CAD geometry.",
    descriptionZh: "扫描图/照片/PDF 转可编辑 CAD 平面",
    category: "import",
    icon: ScanLine,
    status: "available"
  },
  {
    id: "map-to-massing",
    name: "Map to Massing",
    nameZh: "地图转体块",
    description: "Generate coarse massing from map screenshots and hand-drawn outlines.",
    descriptionZh: "地图截图 + 手绘轮廓生成粗体块",
    category: "site",
    icon: Map,
    status: "coming-soon"
  },
  {
    id: "plan-variants",
    name: "Plan Variants",
    nameZh: "多版平面",
    description: "Generate multiple plan layouts within a given outline.",
    descriptionZh: "轮廓内生成多版平面",
    category: "scheme",
    icon: LayoutGrid,
    status: "coming-soon"
  },
  {
    id: "retained-structure-remix",
    name: "Retained Structure Remix",
    nameZh: "保留结构重划",
    description: "Repartition spaces while retaining column grids and cores.",
    descriptionZh: "保留柱网/核心筒后重新划分空间",
    category: "scheme",
    icon: Layers,
    status: "available"
  },
  {
    id: "presentation-generator",
    name: "Presentation Generator",
    nameZh: "汇报生成",
    description: "Build presentation decks from project materials.",
    descriptionZh: "根据项目资料生成汇报 PPT",
    category: "presentation",
    icon: Presentation,
    status: "available",
    workspaceTab: "Presentation"
  },
  {
    id: "render-variants",
    name: "Render Variants",
    nameZh: "概念效果图",
    description: "Generate multiple render briefs from the same massing.",
    descriptionZh: "同一体块生成多种概念效果图 brief",
    category: "presentation",
    icon: Paintbrush,
    status: "coming-soon"
  },
  {
    id: "furniture-layout",
    name: "Furniture Layout",
    nameZh: "家具布置",
    description: "Automatically place furniture within rooms.",
    descriptionZh: "室内家具自动布置",
    category: "interior",
    icon: Sofa,
    status: "coming-soon"
  },
  {
    id: "elevator-retrofit",
    name: "Elevator Retrofit",
    nameZh: "加装电梯",
    description: "Assist with elevator retrofit planning for existing buildings.",
    descriptionZh: "老旧建筑加装电梯助手",
    category: "structure",
    icon: Building2,
    status: "coming-soon"
  },
  {
    id: "concept-structure",
    name: "Concept Structure",
    nameZh: "方案结构",
    description: "Early-stage structural suggestions for schematic design.",
    descriptionZh: "方案阶段结构建议",
    category: "structure",
    icon: Box,
    status: "coming-soon"
  },
  {
    id: "concept-mep",
    name: "Concept MEP",
    nameZh: "方案机电",
    description: "Early-stage MEP routing and system suggestions.",
    descriptionZh: "方案阶段设备建议",
    category: "mep",
    icon: Cpu,
    status: "coming-soon"
  }
];

export function getToolDefinition(toolId: string): ToolDefinition | undefined {
  return toolDefinitions.find((tool) => tool.id === toolId);
}

export function getAvailableTools(): ToolDefinition[] {
  return toolDefinitions.filter((tool) => tool.status === "available");
}
