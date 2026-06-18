import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion, ProjectData } from "@/lib/project-types";
import { getProgramGoals } from "@/lib/project-domain";
import { computeTotalScore } from "@/lib/rules/version-total-score";

export interface VersionEvolutionRow {
  id: string;
  label: string;
  rooms: number;
  grossArea: number;
  totalScore: number;
  deltaRooms?: number;
  deltaArea?: number;
  isActive: boolean;
  parentLabel?: string;
}

export interface VersionEvolutionSummary {
  versionCount: number;
  activeLabel: string;
  lineage: string[];
  evolutionNarrative: string[];
  rows: VersionEvolutionRow[];
  activeDelta?: {
    rooms: number;
    grossArea: number;
    totalScore: number;
    comparedToLabel: string;
  };
}

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

function findParent(version: PlanVersion, versions: PlanVersion[]) {
  if (!version.parentVersionId) {
    return undefined;
  }

  return versions.find((item) => item.id === version.parentVersionId);
}

export function summarizeVersionEvolution(project: ProjectData, activeVersion: PlanVersion): VersionEvolutionSummary {
  const sorted = [...project.versions].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  const rows: VersionEvolutionRow[] = sorted.map((version) => {
    const quantities = calculateQuantities(version);
    const parent = findParent(version, sorted);

    return {
      id: version.id,
      label: version.label,
      rooms: version.rooms.length,
      grossArea: quantities.summary.grossArea,
      totalScore: scoreVersion(version, project),
      isActive: version.id === activeVersion.id,
      parentLabel: parent?.label
    };
  });

  const activeIndex = rows.findIndex((row) => row.isActive);
  const previous = activeIndex > 0 ? rows[activeIndex - 1] : undefined;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;

  if (activeRow && previous) {
    activeRow.deltaRooms = activeRow.rooms - previous.rooms;
    activeRow.deltaArea = Number((activeRow.grossArea - previous.grossArea).toFixed(1));
  }

  const lineage: string[] = [];
  let cursor: PlanVersion | undefined = activeVersion;

  while (cursor) {
    lineage.unshift(cursor.label);
    cursor = findParent(cursor, sorted);
  }

  const evolutionNarrative: string[] = [
    `${project.versions.length} design options explored in this project session.`,
    lineage.length > 1
      ? `Active option "${activeVersion.label}" evolves from ${lineage.slice(0, -1).join(" → ")}.`
      : `"${activeVersion.label}" is the first generated option in the current lineage.`,
    activeVersion.metadata?.strategy
      ? `Strategy: ${activeVersion.metadata.strategy}`
      : "Spatial strategy recorded in version metadata when available."
  ];

  if (activeVersion.metadata?.pipelinePhases) {
    const phases = activeVersion.metadata.pipelinePhases;
    evolutionNarrative.push(
      `Pipeline: topology ${phases.topology ? "✓" : "–"} · geometry ${phases.geometry ? "✓" : "–"} · AI refinement ${phases.refinement ? "✓" : "–"}.`
    );
  }

  if (previous && activeRow) {
    evolutionNarrative.push(
      `Compared to "${previous.label}": ${activeRow.deltaRooms && activeRow.deltaRooms > 0 ? "+" : ""}${activeRow.deltaRooms ?? 0} rooms · ${activeRow.deltaArea && activeRow.deltaArea > 0 ? "+" : ""}${activeRow.deltaArea ?? 0} sqm gross · score ${activeRow.totalScore} vs ${previous.totalScore}.`
    );
  }

  return {
    versionCount: project.versions.length,
    activeLabel: activeVersion.label,
    lineage,
    evolutionNarrative,
    rows,
    activeDelta:
      previous && activeRow
        ? {
            rooms: activeRow.deltaRooms ?? 0,
            grossArea: activeRow.deltaArea ?? 0,
            totalScore: activeRow.totalScore - previous.totalScore,
            comparedToLabel: previous.label
          }
        : undefined
  };
}
