import { calculateQuantities } from "@/lib/quantity-engine";
import type { PresentationSlide } from "@/lib/presentation/types";
import type { PlanVersion, ProjectData } from "@/lib/project-types";
import { getProgramGoals } from "@/lib/project-domain";
import { computeTotalScore } from "@/lib/rules/version-total-score";

function scoreVersion(version: PlanVersion, project: ProjectData) {
  return computeTotalScore(
    version.scores ?? {
      areaEfficiency: 0,
      circulationScore: 0,
      daylightScore: 0,
      mepAlignmentScore: 0,
      riskCount: 0
    },
    getProgramGoals(project.domain)
  );
}

function resolveCompareVersions(
  project: ProjectData,
  activeVersion: PlanVersion,
  compareVersionIds?: string[]
) {
  const selected =
    compareVersionIds && compareVersionIds.length >= 2
      ? compareVersionIds
          .map((id) => project.versions.find((version) => version.id === id))
          .filter((version): version is PlanVersion => Boolean(version))
      : [];

  if (selected.length >= 2) {
    return selected;
  }

  const sorted = [...project.versions].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  if (sorted.length < 2) {
    return [];
  }

  const activeIndex = sorted.findIndex((version) => version.id === activeVersion.id);
  if (activeIndex >= 0) {
    const neighbors = sorted.slice(Math.max(0, activeIndex - 1), activeIndex + 2);
    return neighbors.length >= 2 ? neighbors : sorted.slice(0, 3);
  }

  return sorted.slice(0, Math.min(3, sorted.length));
}

export function buildCompareSlide(
  project: ProjectData,
  activeVersion: PlanVersion,
  compareVersionIds?: string[]
): PresentationSlide | null {
  const versions = resolveCompareVersions(project, activeVersion, compareVersionIds);

  if (versions.length < 2) {
    return null;
  }

  const rows = versions.map((version) => {
    const quantities = calculateQuantities(version);
    const totalScore = scoreVersion(version, project);

    return [
      version.id === activeVersion.id ? `${version.label} *` : version.label,
      String(version.rooms.length),
      String(quantities.summary.grossArea),
      String(totalScore),
      version.metadata?.strategy ?? version.metadata?.topology?.circulation?.slice(0, 48) ?? "—"
    ];
  });

  const activeScore = scoreVersion(activeVersion, project);
  const best = versions.reduce((leader, version) => {
    const score = scoreVersion(version, project);
    return score > scoreVersion(leader, project) ? version : leader;
  }, versions[0]);

  return {
    id: "slide-compare",
    kind: "compare",
    title: "Scheme Comparison",
    subtitle: `${versions.length} options side by side`,
    bullets: [
      `Active option: ${activeVersion.label} · score ${activeScore}.`,
      best.id === activeVersion.id
        ? "Active scheme leads on composite score among compared options."
        : `Highest score among compared options: ${best.label}.`,
      "Use Compare workspace to pin specific schemes for client review."
    ],
    table: {
      headers: ["Version", "Rooms", "Gross sqm", "Score", "Strategy"],
      rows
    }
  };
}
