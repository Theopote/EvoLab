import type { ComplianceResult } from "@/lib/compliance-rules";
import { fixLabelForResult } from "@/lib/compliance-rules";
import type { RulePack } from "@/lib/rules/types";

export interface ComplianceReportItem {
  id: string;
  ruleId: string;
  title: string;
  status: ComplianceResult["status"];
  severity: ComplianceResult["severity"];
  code: string;
  clauseReference: string;
  message: string;
  recommendation: string;
  levelName?: string;
  fixActionLabel?: string;
}

export interface ComplianceReport {
  generatedAt: string;
  rulePackId: string;
  rulePackLabel: string;
  region: string;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    highSeverityWarnings: number;
  };
  items: ComplianceReportItem[];
  narrativeSummary: string;
}

function recommendationForResult(result: ComplianceResult, rulePack: RulePack): string {
  if (result.status === "success") {
    return "当前方案满足该条款的控制要求。";
  }

  const packRule = rulePack.rules.find((rule) => rule.id === result.ruleId);
  const clause = packRule?.code ?? result.code;

  switch (result.ruleId) {
    case "corridor-width":
      return `依据 ${clause}，加宽走道至规范净宽以上，或调整房间边界释放走道宽度。`;
    case "egress-distance":
      return `依据 ${clause}，缩短最远房间至楼梯/出口的路径，或增设疏散核心。`;
    case "daylight":
      return `依据 ${clause}，为需采光房间增加外窗或缩小进深，确保满足采光控制深度。`;
    case "plumbing-proximity":
      return `依据 ${clause}，将湿区集中布置并靠近管井/竖井，减少水平管径与造价。`;
    case "stair-count":
    case "stair-egress-width":
      return `依据 ${clause}，补充或加宽疏散楼梯，核对累计疏散人数与楼梯总净宽。`;
    case "vertical_alignment":
      return `依据 ${clause}，调整各层柱网/核心筒对齐，必要时设置转换层。`;
    default:
      return `依据 ${clause}，请复核 ${result.title} 相关设计参数并调整平面布局。`;
  }
}

export function generateComplianceReport(
  results: ComplianceResult[],
  rulePack: RulePack
): ComplianceReport {
  const warnings = results.filter((item) => item.status === "warning");
  const highSeverityWarnings = warnings.filter((item) => item.severity === "high");

  const items: ComplianceReportItem[] = results.map((result) => {
    const packRule = rulePack.rules.find((rule) => rule.id === result.ruleId);

    return {
      id: result.id,
      ruleId: result.ruleId,
      title: result.title,
      status: result.status,
      severity: result.severity,
      code: packRule?.code ?? result.code,
      clauseReference: packRule?.basis ?? result.basis,
      message: result.message,
      recommendation: recommendationForResult(result, rulePack),
      levelName: result.levelName,
      fixActionLabel: result.fixActionId ? fixLabelForResult(result) : undefined
    };
  });

  const passed = results.filter((item) => item.status === "success").length;
  const narrativeSummary =
    warnings.length === 0
      ? `方案在 ${rulePack.label} 下 ${results.length} 项检查全部通过。`
      : `${rulePack.label} 共 ${results.length} 项检查，${passed} 项通过，${warnings.length} 项需关注${
          highSeverityWarnings.length ? `（其中 ${highSeverityWarnings.length} 项为高优先级）` : ""
        }。`;

  return {
    generatedAt: new Date().toISOString(),
    rulePackId: rulePack.id,
    rulePackLabel: rulePack.label,
    region: rulePack.region ?? "generic",
    summary: {
      total: results.length,
      passed,
      warnings: warnings.length,
      highSeverityWarnings: highSeverityWarnings.length
    },
    items,
    narrativeSummary
  };
}

export function complianceReportToMarkdown(report: ComplianceReport): string {
  const lines = [
    `# 合规检查报告`,
    ``,
    `- 规范包：${report.rulePackLabel} (${report.rulePackId})`,
    `- 地区：${report.region}`,
    `- 生成时间：${report.generatedAt}`,
    `- 摘要：${report.narrativeSummary}`,
    ``,
    `## 检查结果`,
    ``
  ];

  report.items.forEach((item) => {
    lines.push(`### ${item.status === "success" ? "✅" : "⚠️"} ${item.title}`);
    lines.push(`- 条款：${item.code}`);
    lines.push(`- 依据：${item.clauseReference}`);
    lines.push(`- 结论：${item.message}`);
    if (item.status === "warning") {
      lines.push(`- 建议：${item.recommendation}`);
      if (item.fixActionLabel) {
        lines.push(`- 可执行修复：${item.fixActionLabel}`);
      }
    }
    if (item.levelName) {
      lines.push(`- 楼层：${item.levelName}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}
