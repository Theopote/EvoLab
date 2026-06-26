import type { ProjectIntakeRecord } from "@/lib/intake/project-intake-types";

export interface IntakeMaterialInput {
  fileName: string;
  kind: "text" | "pdf" | "image" | "url";
  content?: string;
  base64?: string;
  url?: string;
}

export interface IntakeSynthesisResult extends ProjectIntakeRecord {
  fallback?: boolean;
}

export function createMockIntakeSynthesis(materials: IntakeMaterialInput[]): IntakeSynthesisResult {
  const names = materials.map((item) => item.fileName).join("、");
  const excerpt = materials
    .map((item) => item.content?.slice(0, 120))
    .filter(Boolean)
    .join(" ");

  return {
    summary: names
      ? `基于 ${materials.length} 份资料（${names}）整理的方案阶段启动摘要。${excerpt ? ` 关键片段：${excerpt}` : ""}`
      : "请先上传任务书、现状说明或规划条件等资料。",
    constraints: ["需进一步核实用地退线与限高条件", "地下管线走向待现场复核"],
    risks: ["资料版本可能不是最新批复", "部分扫描件 OCR 精度有限"],
    opportunities: ["现状肌理可转化为公共开放空间", "相邻道路具备展示面优势"],
    openQuestions: ["是否需要预留二期扩建弹性？", "核心筒位置是否有结构顾问初步意见？"],
    updatedAt: new Date().toISOString(),
    fallback: true
  };
}
