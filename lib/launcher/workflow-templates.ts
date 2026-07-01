import type { TypologyPackId } from "@/lib/typology/types";

export interface WorkflowTemplate {
  id: string;
  title: string;
  description: string;
  typologyId?: TypologyPackId;
  href: string;
  badge?: string;
}

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: "blank",
    title: "空白项目",
    description: "从项目选择页新建空白项目，从资料导入开始。",
    href: "/workspace"
  },
  {
    id: "office",
    title: "小型办公",
    description: "典型办公 typology 示例，含方案版本与评分基线。",
    typologyId: "office",
    href: "/workspace?template=office",
    badge: "示例"
  },
  {
    id: "healthcare",
    title: "医疗建筑",
    description: "医疗 typology 与流线/合规检查示例。",
    typologyId: "healthcare",
    href: "/workspace?template=healthcare",
    badge: "示例"
  },
  {
    id: "school",
    title: "学校建筑",
    description: "教育 typology 示例，含教室簇、公共区与流线分析。",
    typologyId: "school",
    href: "/workspace?template=school",
    badge: "示例"
  },
  {
    id: "residential",
    title: "住宅建筑",
    description: "住宅 typology 示例，含单元组合与日照/流线基线。",
    typologyId: "residential",
    href: "/workspace?template=residential",
    badge: "示例"
  },
  {
    id: "retrofit",
    title: "老旧改造",
    description: "从扫描图转 CAD 开始，保留结构后重划空间，再生成汇报。",
    href: "/tools/trace-to-cad"
  },
  {
    id: "presentation",
    title: "方案汇报",
    description: "从项目或工具结果一键生成汇报大纲与 PPT。",
    href: "/tools/presentation-generator"
  },
  {
    id: "elevator",
    title: "加装电梯",
    description: "专项工具（即将推出），快速评估加装方案。",
    href: "/tools/elevator-retrofit"
  }
];
