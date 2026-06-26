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
    description: "从资料导入开始，逐步建立场地、任务书与方案。",
    href: "/workspace?phase=import"
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
    id: "retrofit",
    title: "老旧改造",
    description: "从扫描图转 CAD 开始，保留结构后重划空间。",
    href: "/tools/retained-structure-remix"
  },
  {
    id: "elevator",
    title: "加装电梯",
    description: "专项工具（即将推出），快速评估加装方案。",
    href: "/tools/elevator-retrofit"
  }
];
