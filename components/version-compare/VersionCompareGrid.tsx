"use client";

import { Boxes, Check, GitCompare, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FloorPlan } from "@/components/floor-plan";
import { listComparableLevels } from "@/lib/multi-floor";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";
import {
  compareVersionsAtLevel,
  type VersionLevelCompareRow
} from "@/lib/version-compare-engine";
import type { VersionCompareWorkerResponse } from "@/lib/version-compare-worker";

interface VersionCompareGridProps {
  versions: PlanVersion[];
  activeVersionId: string;
  compareLevelId?: string;
  onCompareLevelChange?: (levelId: string) => void;
  onSelectVersion: (version: PlanVersion) => void;
  onGenerateModel: (version: PlanVersion) => void;
  onRefineVersion: (version: PlanVersion) => void;
}

function scoreVersion(version: PlanVersion) {
  const scores = version.scores;
  const total =
    (scores?.areaEfficiency ?? 0) * 0.28 +
    (scores?.circulationScore ?? 0) * 0.26 +
    (scores?.daylightScore ?? 0) * 0.2 +
    (scores?.mepAlignmentScore ?? 0) * 0.18 -
    (scores?.riskCount ?? 0) * 4;

  return Math.round(Math.max(0, total));
}

function useVersionCompareWorker(
  versions: PlanVersion[],
  levelId: string | undefined,
  enabled: boolean
) {
  const [rows, setRows] = useState<VersionLevelCompareRow[]>([]);
  const [isComputing, setIsComputing] = useState(false);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !levelId || versions.length < 2) {
      setRows([]);
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

        if (event.data.results?.[0]?.rows) {
          setRows(event.data.results[0].rows);
        } else {
          setRows(compareVersionsAtLevel(versions, levelId).rows);
        }
      };
      workerRef.current.postMessage({ requestId, versions, levelIds: [levelId] });
    } catch {
      setRows(compareVersionsAtLevel(versions, levelId).rows);
      setIsComputing(false);
    }
  }, [enabled, levelId, versions]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    },
    []
  );

  return { rows, isComputing };
}

export function VersionCompareGrid({
  versions,
  activeVersionId,
  compareLevelId,
  onCompareLevelChange,
  onSelectVersion,
  onGenerateModel,
  onRefineVersion
}: VersionCompareGridProps) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const levelOptions = useMemo(() => listComparableLevels(versions), [versions]);
  const resolvedLevelId = compareLevelId ?? levelOptions[0]?.id;
  const comparedVersions = versions.filter((version) => compareIds.includes(version.id));
  const { rows: compareRows, isComputing } = useVersionCompareWorker(
    comparedVersions,
    resolvedLevelId,
    comparedVersions.length >= 2
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
              Compare editable PlanVersion options per floor. Metrics run in a Web Worker.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {levelOptions.length > 1 ? (
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
            const quantities = calculateQuantities(version, resolvedLevelId);
            const totalScore = scoreVersion(version);
            const isActive = version.id === activeVersionId;
            const isRecommended = version.id === recommendedId;
            const isCompared = compareIds.includes(version.id);
            const floorCount = version.metadata?.floorCount ?? version.levels.length;

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
                      {version.rooms.length} rooms total · {floorCount} floors · {quantities.summary.grossArea} sqm on
                      selected level
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
                  levelId={resolvedLevelId}
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
          <section className="mt-4 rounded border border-line bg-panel/90 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Pinned comparison</h2>
              <div className="flex items-center gap-2 text-xs text-muted">
                {isComputing ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : null}
                <span>
                  {comparedVersions.length} selected · {levelOptions.find((level) => level.id === resolvedLevelId)?.name}
                </span>
              </div>
            </div>
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
                  {(compareRows.length ? compareRows : comparedVersions.map((version) => {
                    const quantities = calculateQuantities(version, resolvedLevelId);
                    return {
                      versionId: version.id,
                      label: version.label,
                      roomCount: version.levels.find((level) => level.id === resolvedLevelId)?.rooms.length ?? 0,
                      grossArea: quantities.summary.grossArea,
                      netArea: quantities.summary.netUsableArea,
                      circulationRatio: 0,
                      corePosition: [0, 0] as [number, number],
                      riskCount: version.scores?.riskCount ?? 0
                    };
                  })).map((row) => (
                    <tr className="border-t border-line" key={`compare-${row.versionId}`}>
                      <td className="px-3 py-2 text-slate-100">{row.label}</td>
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
          </section>
        ) : null}
      </div>
    </section>
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
