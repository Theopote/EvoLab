import type { ProjectDomain } from "@/lib/building-domain";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";
import { calculateQuantities, checkCompliance } from "@/lib/quantity-engine";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import { buildVerticalAlignmentReport } from "@/lib/vertical-alignment";

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
  projectType?: string
): CopilotFinding[] {
  const scored = ensureVersionScores(version, scoringInputFromDomain(domain, projectType));
  const quantities = calculateQuantities(scored);
  const compliance = checkCompliance(scored, domain.codeContext);
  const alignment = buildVerticalAlignmentReport(scored);
  const findings: CopilotFinding[] = [];

  const warnings = compliance.filter((item) => item.status === "warning");

  warnings.slice(0, 4).forEach((item) => {
    findings.push({
      id: findingId("compliance"),
      tone: "warning",
      text: item.message,
      sub: "From compliance-rules engine"
    });
  });

  if ((scored.scores?.riskCount ?? 0) > 0) {
    findings.push({
      id: findingId("risk"),
      tone: "warning",
      text: `${scored.scores?.riskCount ?? 0} validation or compliance risk(s) on the active scheme.`,
      sub: "From plan validation + compliance engine"
    });
  }

  if (!alignment.aligned) {
    findings.push({
      id: findingId("vertical"),
      tone: "warning",
      text: `${alignment.issues.length} vertical alignment issue(s) across floors.`,
      sub: "From vertical-alignment engine"
    });
  }

  if (quantities.summary.grossArea > 0 && quantities.areaByZone.circulation / quantities.summary.grossArea > 0.28) {
    findings.push({
      id: findingId("circulation"),
      tone: "info",
      text: `Circulation ratio is ${Math.round((quantities.areaByZone.circulation / quantities.summary.grossArea) * 100)}% of gross area.`,
      sub: "From quantity-engine"
    });
  }

  return findings;
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
