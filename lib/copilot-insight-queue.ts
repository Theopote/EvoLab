import type { ProjectDomain } from "@/lib/building-domain";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";
import {
  buildComplianceContext,
  generateComplianceInsights,
  prioritizeComplianceResults,
  runComplianceCheck
} from "@/lib/compliance-rules";
import { calculateQuantities } from "@/lib/quantity-engine";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";

export interface CopilotInsightQueue {
  pending: CopilotFinding[];
  lastReviewedAt: string;
}

function findingId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function buildCopilotInsightsFromEngines(
  version: PlanVersion,
  domain: ProjectDomain,
  projectType?: string,
  activeLevelId?: string
): CopilotFinding[] {
  const scored = ensureVersionScores(version, scoringInputFromDomain(domain, projectType));
  const quantities = calculateQuantities(scored, { scope: "building" });
  const rulePack = resolveRulePack({
    codeContext: domain.codeContext,
    projectType: projectType ?? domain.program?.projectType
  });
  const complianceContext = buildComplianceContext(scored, rulePack, {
    buildingType: projectType ?? domain.program?.projectType ?? "healthcare",
    scoringConfig: domain.scoringConfig
  });
  const complianceResults = prioritizeComplianceResults(runComplianceCheck(complianceContext), activeLevelId);
  const findings: CopilotFinding[] = generateComplianceInsights(complianceResults).slice(0, 8);

  if ((scored.scores?.riskCount ?? 0) > 0 && findings.length === 0) {
    findings.push({
      id: findingId("risk"),
      tone: "warning",
      text: `${scored.scores?.riskCount ?? 0} validation or compliance risk(s) on the active scheme.`,
      sub: "From plan validation + compliance engine"
    });
  }

  if (quantities.summary.grossArea > 0 && quantities.areaByZone.circulation / quantities.summary.grossArea > 0.28) {
    findings.push({
      id: findingId("circulation"),
      tone: "info",
      text: `Circulation ratio is ${Math.round((quantities.areaByZone.circulation / quantities.summary.grossArea) * 100)}% of gross area.`,
      sub: "From quantity-engine · building scope"
    });
  }

  if (activeLevelId && version.levels.length > 1) {
    const levelQuantities = calculateQuantities(scored, { levelId: activeLevelId, scope: "level" });
    const levelName = version.levels.find((level) => level.id === activeLevelId)?.name ?? activeLevelId;
    const levelWarnings = complianceResults.filter(
      (result) => result.status === "warning" && result.levelId === activeLevelId
    ).length;

    if (levelWarnings > 0) {
      findings.unshift({
        id: findingId("level-risk"),
        tone: "warning",
        text: `${levelWarnings} compliance warning(s) on ${levelName}.`,
        sub: "Active floor · compliance engine"
      });
    }

    if (levelQuantities.summary.grossArea > 0) {
      findings.push({
        id: findingId("level-area"),
        tone: "info",
        text: `${levelName} gross area is ${levelQuantities.summary.grossArea} sqm.`,
        sub: "Active floor · quantity-engine"
      });
    }
  }

  return findings.slice(0, 8);
}

export function enqueueInsights(
  queue: CopilotInsightQueue | undefined,
  fresh: CopilotFinding[]
): CopilotInsightQueue {
  const existingIds = new Set((queue?.pending ?? []).map((item) => item.text));

  const pending = [
    ...(queue?.pending ?? []),
    ...fresh.filter((item) => !existingIds.has(item.text))
  ].slice(-12);

  return {
    pending,
    lastReviewedAt: queue?.lastReviewedAt ?? new Date(0).toISOString()
  };
}

export function markInsightsReviewed(queue: CopilotInsightQueue): CopilotInsightQueue {
  return {
    pending: [],
    lastReviewedAt: new Date().toISOString()
  };
}

export function pendingInsightCount(queue: CopilotInsightQueue | undefined) {
  return queue?.pending.length ?? 0;
}
