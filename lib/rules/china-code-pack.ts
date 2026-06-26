import type { ScoringThresholds } from "@/lib/rules/types";
import type { RulePack } from "@/lib/rules/types";

const chinaHealthcareScoring: ScoringThresholds = {
  circulationTargetRatio: 0.18,
  circulationTolerance: 0.16,
  plumbingMaxDistanceM: 10,
  egressMaxDistanceM: 30,
  daylightMaxDepthM: 8,
  areaEfficiencyFactor: 92
};

export const chinaHealthcareRulePack: RulePack = {
  id: "code-cn-healthcare-gb",
  label: "中国 · 医疗建筑方案阶段",
  region: "CN",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "疏散走道净宽",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.18：医疗建筑疏散走道净宽不应小于 1.4m。",
      code: "GB 50016 §5.5.18",
      threshold: 1.4,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "安全疏散距离",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.17：位于两个安全出口间房间至最近安全出口距离（医疗建筑）不应大于 30m。",
      code: "GB 50016 §5.5.17",
      threshold: 30,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "安全出口与疏散楼梯",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.8：每层至少应设置 1 个安全出口或疏散楼梯。",
      code: "GB 50016 §5.5.8",
      threshold: 1,
      comparator: "gte"
    },
    {
      id: "daylight",
      category: "daylight",
      title: "天然采光进深",
      basis: "《民用建筑设计统一标准》GB 50352-2019 §7.1.2：主要功能房间天然采光进深不宜大于 2.5 倍窗高（方案阶段按 8m 控制）。",
      code: "GB 50352 §7.1.2",
      threshold: 8,
      unit: "m",
      comparator: "lte"
    }
  ],
  scoring: chinaHealthcareScoring
};

export const chinaOfficeRulePack: RulePack = {
  id: "code-cn-office-gb",
  label: "中国 · 办公建筑方案阶段",
  region: "CN",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "疏散走道净宽",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.18：高层公共建筑疏散走道净宽不应小于 1.4m。",
      code: "GB 50016 §5.5.18",
      threshold: 1.4,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "安全疏散距离",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.17：位于两个安全出口间房间至最近安全出口距离（高层公共建筑）不应大于 30m。",
      code: "GB 50016 §5.5.17",
      threshold: 30,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "疏散楼梯数量",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.13：高层公共建筑每层至少 2 个疏散楼梯（方案阶段至少 1 个核心）。",
      code: "GB 50016 §5.5.13",
      threshold: 1,
      comparator: "gte"
    }
  ],
  scoring: {
    circulationTargetRatio: 0.16,
    circulationTolerance: 0.15,
    plumbingMaxDistanceM: 10,
    egressMaxDistanceM: 30,
    daylightMaxDepthM: 10,
    areaEfficiencyFactor: 94
  }
};

export const chinaResidentialRulePack: RulePack = {
  id: "code-cn-residential-gb",
  label: "中国 · 住宅建筑方案阶段",
  region: "CN",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "疏散走道净宽",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.18：住宅疏散走道净宽不应小于 1.1m。",
      code: "GB 50016 §5.5.18",
      threshold: 1.1,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "户门至安全出口距离",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.29：高层住宅户门至最近安全出口距离不应大于 25m。",
      code: "GB 50016 §5.5.29",
      threshold: 25,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "疏散楼梯",
      basis: "《建筑设计防火规范》GB 50016-2014（2018版）§5.5.12：高层住宅每层至少 1 个疏散楼梯。",
      code: "GB 50016 §5.5.12",
      threshold: 1,
      comparator: "gte"
    }
  ],
  scoring: {
    circulationTargetRatio: 0.12,
    circulationTolerance: 0.14,
    plumbingMaxDistanceM: 8,
    egressMaxDistanceM: 25,
    daylightMaxDepthM: 6,
    areaEfficiencyFactor: 90
  }
};

export function resolveChinaRulePack(projectType: string): RulePack {
  const key = projectType.trim().toLowerCase();

  if (key.includes("health") || key.includes("clinic") || key.includes("hospital")) {
    return chinaHealthcareRulePack;
  }

  if (key.includes("residential") || key.includes("housing") || key.includes("apartment")) {
    return chinaResidentialRulePack;
  }

  return chinaOfficeRulePack;
}
