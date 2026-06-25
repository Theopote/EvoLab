"use client";

import { Boxes, Check, GitCompare, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { SchemeCompareGrid } from "@/components/comparison/SchemeCompareGrid";
import { SchemeHybridPanel } from "@/components/comparison/SchemeHybridPanel";
import { VersionCompareExplainPanel } from "@/components/score/VersionCompareExplainPanel";
import { listComparableLevelGroups, listComparableLevels } from "@/lib/multi-floor";
import type { ProgramModel, ProjectDomain } from "@/lib/building-domain";
import { getProgramGoals } from "@/lib/project-domain";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";
import { ensureVersionScores, scoringInputFromDomain } from "@/lib/rules/resolve-version-scoring";
import {
  compareVersionsAtLevel,
  compareVersionsAtLevelIndex,
  compareVersionsBuildingTotal,
  scoreVersion,
  type VersionBuildingCompareRow,
  type VersionCompareScope,
  type VersionLevelCompareResult,
  type VersionLevelCompareRow
} from "@/lib/version-compare-engine";
import type { VersionCompareWorkerResponse } from "@/lib/version-compare-worker";

interface VersionCompareGridProps {
  versions: PlanVersion[];
  activeVersionId: string;
  compareLevelId?: string;
  domain?: ProjectDomain;
  program?: ProgramModel;
  projectType?: string;
  orientationDeg?: number;
  onCompareLevelChange?: (levelId: string) => void;
  onSelectVersion: (version: PlanVersion) => void;
  onGenerateModel: (version: PlanVersion) => void;
  onRefineVersion: (version: PlanVersion) => void;
}

function useVersionCompareWorker(
  versions: PlanVersion[],
  levelIds: string[],
  levelIndices: number[],
  scope: VersionCompareScope,
  enabled: boolean
) {
  const [levelResults, setLevelResults] = useState<VersionLevelCompareResult[]>([]);
  const [buildingRows, setBuildingRows] = useState<VersionBuildingCompareRow[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    if (!enabled || versions.length < 2) {
      setLevelResults([]);
      setBuildingRows([]);
      setIsComputing(false);
      return;
    }

    if (scope === "building-total") {
      setLevelResults([]);
      setBuildingRows(compareVersionsBuildingTotal(versions));
      setIsComputing(false);
      return;
    }

    if (!levelIds.length && !levelIndices.length) {
      setLevelResults([]);
      setBuildingRows([]);
      setIsComputing(false);
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setIsComputing(true);

    try {
      workerRef.current ??= new Worker(new URL("../../lib/version-compare-worker.ts", import.meta.url), {
        type: "module"
      });
      workerRef.current.onmessage = (event: MessageEvent<VersionCompareWorkerResponse>) => {
        if (event.data.requestId !== requestIdRef.current) {
          return;
        }

        setIsComputing(false);

        if (event.data.results?.length) {
          setLevelResults(event.data.results);
        } else if (levelIndices.length) {
          setLevelResults(
            levelIndices.map((levelIndex) =>
              compareVersionsAtLevel(versions, versions[0]?.levels[levelIndex - 1]?.id ?? `level-${String(levelIndex).padStart(2, "0")}`)
            )
          );
        } else {
          setLevelResults(levelIds.map((levelId) => compareVersionsAtLevel(versions, levelId)));
        }
      };
      workerRef.current.postMessage({
        requestId,
        versions,
        levelIds: levelIndices.length ? undefined : levelIds,
        levelIndices: levelIndices.length ? levelIndices : undefined
      });
    } catch {
      setLevelResults(
        levelIndices.length
          ? levelIndices.map((levelIndex) =>
              compareVersionsAtLevel(versions, versions[0]?.levels[levelIndex - 1]?.id ?? `level-${String(levelIndex).padStart(2, "0")}`)
            )
          : levelIds.map((levelId) => compareVersionsAtLevel(versions, levelId))
      );
      setIsComputing(false);
    }
  }, [enabled, levelIds, levelIndices, scope, versions]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    },
    []
  );

  return { levelResults, buildingRows, isComputing };
}

export function VersionCompareGrid({
  versions,
  activeVersionId,
  compareLevelId,
  domain,
  program,
  projectType,
  orientationDeg,
  onCompareLevelChange,
  onSelectVersion,
  onGenerateModel,
  onRefineVersion
}: VersionCompareGridProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareScope, setCompareScope] = useState<VersionCompareScope>("selected-level");
  const levelOptions = useMemo(() => listComparableLevels(versions), [versions]);
  const levelGroups = useMemo(() => listComparableLevelGroups(versions), [versions]);
  const resolvedLevelId = compareLevelId ?? levelOptions[0]?.id;
  const comparedVersions = versions.filter((version) => compareIds.includes(version.id));
  const compareLevelIds = useMemo(() => {
    if (compareScope !== "selected-level" || !resolvedLevelId) {
      return [];
    }

    return [resolvedLevelId];
  }, [compareScope, resolvedLevelId]);
  const compareLevelIndices = useMemo(() => {
    if (compareScope !== "all-levels") {
      return [];
    }

    return levelGroups.map((group) => group.levelIndex);
  }, [compareScope, levelGroups]);
  const { levelResults, buildingRows, isComputing } = useVersionCompareWorker(
    comparedVersions,
    compareLevelIds,
    compareLevelIndices,
    compareScope,
    comparedVersions.length >= 2
  );
  const scoringInput = useMemo(
    () =>
      domain
        ? scoringInputFromDomain(domain, projectType)
        : {
            program,
            projectType,
            orientationDeg
          },
    [domain, orientationDeg, program, projectType]
  );
  const scoredComparedVersions = useMemo(
    () => comparedVersions.map((version) => ensureVersionScores(version, scoringInput)),
    [comparedVersions, scoringInput]
  );
  const recommendedId = useMemo(
    () => [...versions].sort((a, b) => scoreVersion(b) - scoreVersion(a))[0]?.id,
    [versions]
  );

  function toggleCompare(versionId: string) {
    setCompareIds((current) =>
      current.includes(versionId)
        ? current.filter((id) => id !== versionId)
        : [...current, versionId].slice(-3)
    );
  }

  if (versions.length === 0) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate plan options before comparing versions.
      </div>
    );
  }

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="rounded border border-line bg-panel/90 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-white">Version Compare</h1>
            <p className="mt-1 text-xs text-muted">
              Compare editable PlanVersion options per floor or across all floors in one worker batch.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
              value={compareScope}
              onChange={(event) => setCompareScope(event.target.value as VersionCompareScope)}
            >
              <option value="selected-level">Selected level</option>
              <option value="all-levels">All floors (L1 vs L1…)</option>
              <option value="building-total">Building total</option>
            </select>
            {compareScope === "selected-level" && levelOptions.length > 1 ? (
              <select
                className="h-8 rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
                value={resolvedLevelId}
                onChange={(event) => onCompareLevelChange?.(event.target.value)}
              >
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            ) : null}
            <span className="rounded border border-line px-2 py-1 text-xs text-muted">
              {versions.length} versions
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 overflow-auto">
        <div className="grid gap-3 xl:grid-cols-3">
          {versions.map((version) => {
            const quantities =
              compareScope === "building-total"
                ? calculateQuantities(version, { scope: "building" })
                : calculateQuantities(version, { levelId: resolvedLevelId, scope: "level" });
            const totalScore = scoreVersion(version);
            const isActive = version.id === activeVersionId;
            const isRecommended = version.id === recommendedId;
            const isCompared = compareIds.includes(version.id);
            const floorCount = version.metadata?.floorCount ?? version.levels.length;
            const previewLevelId =
              compareScope === "selected-level"
                ? resolvedLevelId
                : version.levels[0]?.id;

            return (
              <article
                className={`rounded border bg-panel/90 p-3 ${
                  isActive ? "border-accent/70" : "border-line"
                }`}
                key={version.id}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-white">{version.label}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {version.rooms.length} rooms total · {floorCount} floors · {quantities.summary.grossArea} sqm
                      {compareScope === "building-total" ? " building" : " on selected level"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {isRecommended ? (
                      <span className="flex items-center gap-1 rounded border border-success/40 px-2 py-1 text-[11px] text-success">
                        <Sparkles className="h-3 w-3" />
                        Recommended
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="rounded border border-accent/40 px-2 py-1 text-[11px] text-accent">Active</span>
                    ) : null}
                  </div>
                </div>

                <FloorPlan
                  version={version}
                  levelId={previewLevelId}
                  className="mb-3 [&>div]:min-h-[210px] [&_svg]:min-h-[210px]"
                  interactive={false}
                />

                <div className="mb-3 grid grid-cols-5 gap-2 text-xs">
                  <Metric label="Total" value={totalScore} />
                  <Metric label="Area" value={version.scores?.areaEfficiency ?? 0} />
                  <Metric label="Flow" value={version.scores?.circulationScore ?? 0} />
                  <Metric label="Light" value={version.scores?.daylightScore ?? 0} />
                  <Metric label="MEP" value={version.scores?.mepAlignmentScore ?? 0} />
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                  <Data label="Risks" value={String(version.scores?.riskCount ?? 0)} tone="warning" />
                  <Data label="Walls" value={`${quantities.summary.wallArea} sqm`} />
                  <Data label="Windows" value={String(quantities.summary.windowCount)} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onSelectVersion(version)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Set Active
                  </button>
                  <button
                    className={`flex h-8 items-center justify-center gap-2 rounded border text-xs ${
                      isCompared
                        ? "border-accent/60 text-accent"
                        : "border-line text-slate-100 hover:border-accent/60 hover:text-accent"
                    }`}
                    type="button"
                    onClick={() => toggleCompare(version.id)}
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Compare
                  </button>
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onRefineVersion(version)}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Refine
                  </button>
                  <button
                    className="flex h-8 items-center justify-center gap-2 rounded border border-line text-xs text-slate-100 hover:border-accent/60 hover:text-accent"
                    type="button"
                    onClick={() => onGenerateModel(version)}
                  >
                    <Boxes className="h-3.5 w-3.5" />
                    Model
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {comparedVersions.length ? (
          <section className="mt-4 space-y-3">
            {compareScope === "selected-level" && comparedVersions.length === 2 ? (
              <SchemeHybridPanel
                levelId={resolvedLevelId}
                versionA={comparedVersions[0]!}
                versionB={comparedVersions[1]!}
              />
            ) : null}

            {compareScope === "selected-level" && comparedVersions.length >= 2 ? (
              <SchemeCompareGrid
                versions={comparedVersions}
                levelId={resolvedLevelId}
                domain={domain}
                projectType={projectType}
              />
            ) : null}

            {scoredComparedVersions.length === 2 ? (
              <VersionCompareExplainPanel
                left={scoredComparedVersions[0]!}
                right={scoredComparedVersions[1]!}
                program={program}
                projectType={projectType}
                programGoals={domain ? getProgramGoals(domain, projectType) : undefined}
              />
            ) : null}

            <div className="rounded border border-line bg-panel/90 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Pinned comparison</h2>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {isComputing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : null}
                  <span>
                    {comparedVersions.length} selected ·{" "}
                    {compareScope === "building-total"
                      ? "Building total"
                      : compareScope === "all-levels"
                        ? `${levelResults.length} floors`
                        : levelOptions.find((level) => level.id === resolvedLevelId)?.name}
                  </span>
                </div>
              </div>

            {compareScope === "building-total" ? (
              <CompareTable
                rows={(buildingRows.length ? buildingRows : compareVersionsBuildingTotal(comparedVersions)).map((row) => ({
                  versionId: row.versionId,
                  label: row.label,
                  levelId: "building-total",
                  levelName: "Building total",
                  roomCount: row.roomCount,
                  grossArea: row.grossArea,
                  netArea: row.netArea,
                  totalScore: row.totalScore,
                  circulationRatio: row.circulationRatio,
                  corePosition: [0, 0] as [number, number],
                  riskCount: row.riskCount,
                  extraLabel: `${row.floorCount} floors`
                }))}
              />
            ) : (
              <div className="grid gap-3">
                {(levelResults.length
                  ? levelResults
                  : compareLevelIndices.map((levelIndex) => compareVersionsAtLevelIndex(comparedVersions, levelIndex))
                ).map((result) => (
                  <div key={result.levelId}>
                    {compareScope === "all-levels" ? (
                      <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
                        {result.levelName}
                      </h3>
                    ) : null}
                    <CompareTable rows={result.rows} />
                  </div>
                ))}
              </div>
            )}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function CompareTable({
  rows
}: {
  rows: Array<
    VersionLevelCompareRow & {
      extraLabel?: string;
    }
  >;
}) {
  return (
    <div className="overflow-hidden rounded border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
          <tr>
            <th className="px-3 py-2">Version</th>
            <th className="px-3 py-2 text-right">Rooms</th>
            <th className="px-3 py-2 text-right">Gross sqm</th>
            <th className="px-3 py-2 text-right">Net sqm</th>
            <th className="px-3 py-2 text-right">Circ %</th>
            <th className="px-3 py-2 text-right">Core X/Y</th>
            <th className="px-3 py-2 text-right">Risks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line" key={`compare-${row.versionId}-${row.levelId ?? "building"}`}>
              <td className="px-3 py-2 text-slate-100">
                {row.label}
                {row.extraLabel ? <span className="ml-2 text-xs text-muted">{row.extraLabel}</span> : null}
              </td>
              <td className="px-3 py-2 text-right text-muted">{row.roomCount}</td>
              <td className="px-3 py-2 text-right text-muted">{row.grossArea}</td>
              <td className="px-3 py-2 text-right text-muted">{row.netArea}</td>
              <td className="px-3 py-2 text-right text-muted">
                {Math.round((row.circulationRatio ?? 0) * 100)}%
              </td>
              <td className="px-3 py-2 text-right text-muted">
                {row.corePosition[0].toFixed(1)} / {row.corePosition[1].toFixed(1)}
              </td>
              <td className="px-3 py-2 text-right text-warning">{row.riskCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2 text-center">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}

function Data({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-1 text-xs ${tone === "warning" ? "text-warning" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
