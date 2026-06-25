import { listComparableLevels } from "@/lib/multi-floor";
import type { CompareReport } from "@/lib/compare/compare-report-types";
import { roomsForCompareLevel, summarizeRoomChangesAtLevel } from "@/lib/compare/geometry-diff";
import { renderCompareDiffSvg } from "@/lib/compare/render-compare-diff-svg";
import { resolveCompareVersions } from "@/lib/compare/resolve-compare-versions";
import type { ProjectDomain, ProgramModel } from "@/lib/building-domain";
import { getProgramGoals } from "@/lib/project-domain";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import { compareVersionScores, computeTotalScore } from "@/lib/rules/version-total-score";

export interface BuildCompareReportInput {
  projectName: string;
  projectType: string;
  domain: ProjectDomain;
  program: ProgramModel;
  activeVersionId: string;
  versions: PlanVersion[];
  compareVersionIds: string[];
  compareLevelId?: string;
}

const emptyScores = {
  areaEfficiency: 0,
  circulationScore: 0,
  daylightScore: 0,
  mepAlignmentScore: 0,
  riskCount: 0
};

export function buildCompareReport(input: BuildCompareReportInput): CompareReport | null {
  const compared = resolveCompareVersions(input.versions, input.activeVersionId, input.compareVersionIds);

  if (compared.length < 2) {
    return null;
  }

  const scoringInput = scoringInputFromDomain(input.domain, input.projectType);
  const programGoals = getProgramGoals(input.domain);
  const scored = compared.map((version) => ensureVersionScores(version, scoringInput));
  const levelOptions = listComparableLevels(compared);
  const resolvedLevelId = input.compareLevelId ?? levelOptions[0]?.id;
  const levelName = levelOptions.find((level) => level.id === resolvedLevelId)?.name;

  const recommended = [...scored].sort(
    (left, right) =>
      computeTotalScore(right.scores ?? emptyScores, programGoals) -
      computeTotalScore(left.scores ?? emptyScores, programGoals)
  )[0]!;

  const active = scored.find((version) => version.id === input.activeVersionId) ?? scored[0]!;
  const explainAgainst =
    active.id === recommended.id
      ? scored.find((version) => version.id !== recommended.id) ?? active
      : active;

  const recommendedScores = recommended.scores ?? emptyScores;
  const explainScores = explainAgainst.scores ?? emptyScores;
  const leftTotal = computeTotalScore(recommendedScores, programGoals);
  const rightTotal = computeTotalScore(explainScores, programGoals);
  const comparison = compareVersionScores(recommendedScores, explainScores, programGoals);

  const versionRows = scored.map((version) => {
    const scores = version.scores ?? emptyScores;
    const quantities = calculateQuantities(version, { levelId: resolvedLevelId, scope: "level" });

    return {
      id: version.id,
      label: version.label,
      isActive: version.id === input.activeVersionId,
      isRecommended: version.id === recommended.id,
      roomCount: version.rooms.length,
      grossArea: quantities.summary.grossArea,
      netArea: quantities.summary.netArea,
      totalScore: computeTotalScore(scores, programGoals),
      areaEfficiency: scores.areaEfficiency,
      circulationScore: scores.circulationScore,
      daylightScore: scores.daylightScore,
      mepAlignmentScore: scores.mepAlignmentScore,
      riskCount: scores.riskCount,
      strategy: version.metadata?.strategy ?? version.metadata?.topology?.circulation?.slice(0, 64)
    };
  });

  const metricTable = {
    headers: ["Version", "Rooms", "Gross sqm", "Net sqm", "Score", "Area", "Flow", "Daylight", "MEP", "Risks", "Strategy"],
    rows: versionRows.map((row) => [
      `${row.label}${row.isActive ? " *" : ""}${row.isRecommended ? " ★" : ""}`,
      String(row.roomCount),
      String(row.grossArea),
      String(row.netArea),
      String(row.totalScore),
      String(row.areaEfficiency),
      String(row.circulationScore),
      String(row.daylightScore),
      String(row.mepAlignmentScore),
      String(row.riskCount),
      row.strategy ?? "—"
    ])
  };

  let diff: CompareReport["diff"];
  if (scored.length >= 2) {
    const base = scored[0]!;
    const preview = scored[1]!;
    const baseSlice = { ...base, rooms: roomsForCompareLevel(base, resolvedLevelId) };
    const previewSlice = { ...preview, rooms: roomsForCompareLevel(preview, resolvedLevelId) };
    const changes = summarizeRoomChangesAtLevel(base, preview, resolvedLevelId);

    diff = {
      baseLabel: base.label,
      previewLabel: preview.label,
      added: changes.added.length,
      modified: changes.modified.length,
      removed: changes.removed.length,
      svg: renderCompareDiffSvg(baseSlice, previewSlice, changes)
    };
  }

  const summary =
    leftTotal === rightTotal
      ? `${recommended.label} ties ${explainAgainst.label} on composite score (${leftTotal}).`
      : `${recommended.label} leads ${explainAgainst.label} by ${Math.abs(leftTotal - rightTotal)} points (${leftTotal} vs ${rightTotal}).`;

  return {
    projectName: input.projectName,
    projectType: input.projectType,
    generatedAt: new Date().toISOString(),
    levelName,
    pinnedVersionLabels: compared.map((version) => version.label),
    versions: versionRows,
    recommendation: {
      versionId: recommended.id,
      versionLabel: recommended.label,
      summary,
      explanations: comparison.explanations.slice(0, 6),
      comparedAgainstLabel: explainAgainst.label,
      leftTotal,
      rightTotal
    },
    diff,
    metricTable
  };
}
