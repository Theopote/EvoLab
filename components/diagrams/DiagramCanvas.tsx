"use client";

import { useEffect, useRef, useState } from "react";
import { computeAnalysis, type AnalysisResult } from "@/lib/analysis-engine";
import { getAnalysisLayersForProject } from "@/components/diagrams/DiagramLayerList";
import { layerRequested } from "@/lib/typology/analysis-layers";
import type { AnalysisWorkerResponse } from "@/lib/analysis-worker";
import type { AnalysisLayerId, PlanVersion, Point, Room } from "@/lib/project-types";

interface DiagramCanvasProps {
  activeLayers: AnalysisLayerId[];
  version?: PlanVersion;
  levelId?: string;
  projectType?: string;
}

const zoneColors: Record<Room["zone"], string> = {
  public: "rgba(79, 181, 200, 0.32)",
  semi_public: "rgba(132, 204, 22, 0.26)",
  private: "rgba(167, 139, 250, 0.26)",
  service: "rgba(230, 162, 60, 0.3)",
  circulation: "rgba(148, 163, 184, 0.24)"
};

const zoneStrokes: Record<Room["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

const layerLegend: Partial<Record<AnalysisLayerId, { color: string; label: string }>> = {
  function_zones: { color: "#4fb5c8", label: "Zone fill by function" },
  primary_flow: { color: "#38bdf8", label: "Primary route" },
  patient_flow: { color: "#38bdf8", label: "Primary route" },
  staff_flow: { color: "#a78bfa", label: "Staff route" },
  service_flow: { color: "#f59e0b", label: "Service route" },
  clean_dirty_flow: { color: "#f59e0b", label: "Service route" },
  daylight: { color: "#facc15", label: "Daylight exposure" },
  ventilation: { color: "#5eead4", label: "Ventilation vector" },
  sightline: { color: "#fb7185", label: "Sightline cone" },
  egress_path: { color: "#22c55e", label: "Egress path" },
  egress_distance: { color: "#f97316", label: "Egress distance band" },
  core_efficiency: { color: "#c084fc", label: "Core distance" }
};

function polygonPoints(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function pathPoints(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function egressLegendNote(analysis: AnalysisResult | undefined, layerId: AnalysisLayerId) {
  if (layerId !== "egress_path" && layerId !== "egress_distance") {
    return null;
  }

  const summary = analysis?.egressSummary;
  if (!summary) {
    return null;
  }

  const issueRooms = analysis.egressDiagnostics.filter((item) => !item.semanticValid);
  if (issueRooms.length === 0) {
    return summary.label;
  }

  const missingCounts = issueRooms.reduce<Record<string, number>>((acc, item) => {
    item.missingLinks.forEach((link) => {
      acc[link] = (acc[link] ?? 0) + 1;
    });
    return acc;
  }, {});

  const missingSummary = Object.entries(missingCounts)
    .map(([link, count]) => `${count}× ${link}`)
    .join(" · ");

  return `${summary.label} · ${issueRooms.length} incomplete (${missingSummary})`;
}

function useWorkerAnalysis(
  version: PlanVersion | undefined,
  activeLayers: AnalysisLayerId[],
  levelId?: string,
  projectType?: string
) {
  const [analysis, setAnalysis] = useState<AnalysisResult | undefined>(undefined);
  const [isComputing, setIsComputing] = useState(false);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | undefined>(undefined);

  useEffect(() => {
    if (!version) {
      setAnalysis(undefined);
      setIsComputing(false);
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setIsComputing(true);

    try {
      workerRef.current ??= new Worker(new URL("../../lib/analysis-worker.ts", import.meta.url), {
        type: "module"
      });
      workerRef.current.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
        if (event.data.requestId !== requestIdRef.current) {
          return;
        }

        setIsComputing(false);

        if (event.data.result) {
          setAnalysis(event.data.result);
        } else {
          setAnalysis(computeAnalysis(version, activeLayers, { levelId, projectType }));
        }
      };
      workerRef.current.postMessage({ requestId, version, activeLayers, levelId, projectType });
    } catch {
      setAnalysis(computeAnalysis(version, activeLayers, { levelId, projectType }));
      setIsComputing(false);
    }
  }, [activeLayers, levelId, projectType, version]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = undefined;
    },
    []
  );

  return { analysis, isComputing };
}

export function DiagramCanvas({ activeLayers, version, levelId, projectType }: DiagramCanvasProps) {
  const { analysis, isComputing } = useWorkerAnalysis(version, activeLayers, levelId, projectType);
  const analysisLayers = getAnalysisLayersForProject(projectType);
  const primaryFlow = analysis?.primaryFlow ?? analysis?.patientFlow;
  const serviceFlow = analysis?.serviceFlow ?? analysis?.cleanDirtyFlow;

  if (!version) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Select or generate a plan version to show analysis overlays.
      </div>
    );
  }

  const padding = 8;
  const viewBox = `${-padding} ${-padding} ${version.overallBounds.width + padding * 2} ${
    version.overallBounds.height + padding * 2
  }`;

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Analysis Canvas</h1>
          <p className="mt-1 text-xs text-muted">
            Pathfinding, raycasting, and daylight probes run in a Web Worker off the main thread.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isComputing ? (
            <span className="rounded border border-line px-2 py-1 text-xs text-muted">Computing overlays…</span>
          ) : null}
          <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">
            {version.label}
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded border border-line bg-[#081018] shadow-insetGrid">
        <div className="pointer-events-none absolute inset-0 cad-grid opacity-70" />
        <svg className="relative h-full min-h-[560px] w-full" viewBox={viewBox} role="img">
          <defs>
            <marker id="arrow-patient" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#38bdf8" />
            </marker>
            <marker id="arrow-staff" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#a78bfa" />
            </marker>
            <marker id="arrow-egress" markerHeight="5" markerWidth="5" orient="auto" refX="4" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="#22c55e" />
            </marker>
          </defs>

          <polygon points={polygonPoints(version.outline)} fill="rgba(255,255,255,0.018)" stroke="#d8edf5" strokeWidth="0.35" />

          {version.rooms.map((room) => (
            <polygon
              fill={activeLayers.includes("function_zones") ? zoneColors[room.zone] : "rgba(148,163,184,0.08)"}
              key={room.id}
              points={polygonPoints(room.polygon)}
              stroke={activeLayers.includes("function_zones") ? zoneStrokes[room.zone] : "rgba(216,237,245,0.4)"}
              strokeWidth="0.25"
            />
          ))}

          {activeLayers.includes("daylight")
            ? analysis?.daylightRooms.map((room) => {
                  const [x, y] = room.center;
                  return (
                    <g key={`daylight-${room.roomId}`}>
                      <circle cx={x} cy={y} fill="rgba(250,204,21,0.18)" r={room.radius} />
                      <text fill="#facc15" fontSize="1.3" textAnchor="middle" x={x} y={y + 0.45}>
                        DL
                      </text>
                    </g>
                  );
                })
            : null}

          {(layerRequested(activeLayers, "primary_flow") || layerRequested(activeLayers, "patient_flow")) && primaryFlow ? (
            <polyline
              fill="none"
              markerEnd="url(#arrow-patient)"
              points={pathPoints(primaryFlow.points)}
              stroke="#38bdf8"
              strokeDasharray="2 1.4"
              strokeWidth="0.7"
            />
          ) : null}

          {activeLayers.includes("staff_flow") && analysis?.staffFlow ? (
            <polyline
              fill="none"
              markerEnd="url(#arrow-staff)"
              points={pathPoints(analysis.staffFlow.points)}
              stroke="#a78bfa"
              strokeWidth="0.65"
            />
          ) : null}

          {(layerRequested(activeLayers, "service_flow") || layerRequested(activeLayers, "clean_dirty_flow")) && serviceFlow ? (
            <g>
              {serviceFlow.dirty ? (
                <polyline fill="none" points={pathPoints(serviceFlow.dirty.points)} stroke="#f59e0b" strokeDasharray="1 1" strokeWidth="0.65" />
              ) : null}
              {serviceFlow.clean ? (
                <polyline fill="none" points={pathPoints(serviceFlow.clean.points)} stroke="#5eead4" strokeDasharray="2 1" strokeWidth="0.5" />
              ) : null}
            </g>
          ) : null}

          {activeLayers.includes("ventilation")
            ? analysis?.ventilationVectors.map((vector) => (
                <line key={vector.id} stroke="#5eead4" strokeWidth="0.45" x1={vector.from[0]} x2={vector.to[0]} y1={vector.from[1]} y2={vector.to[1]} />
              ))
            : null}

          {activeLayers.includes("sightline") && analysis?.sightlineCone ? (
            <polygon
              fill="rgba(251,113,133,0.12)"
              points={pathPoints(analysis.sightlineCone)}
              stroke="#fb7185"
              strokeDasharray="1.5 1"
              strokeWidth="0.35"
            />
          ) : null}

          {activeLayers.includes("egress_path")
            ? analysis?.egressPaths.map((path) => (
                <polyline
                  key={path.id}
                  fill="none"
                  markerEnd="url(#arrow-egress)"
                  points={pathPoints(path.points)}
                  stroke={path.semanticValid === false ? "#f59e0b" : "#22c55e"}
                  strokeDasharray={path.semanticValid === false ? "1.2 0.8" : undefined}
                  strokeOpacity="0.9"
                  strokeWidth="0.45"
                />
              ))
            : null}

          {activeLayers.includes("egress_distance")
            ? analysis?.egressDiagnostics.map((item) => {
                const room = analysis.egressDistances.find((distance) => distance.roomId === item.roomId);
                if (!room) {
                  return null;
                }
                const [x, y] = room.center;
                return (
                  <g key={`egress-diagnostic-${item.roomId}`}>
                    <text
                      fill={item.semanticValid ? "#9fb3c8" : "#f59e0b"}
                      fontSize="1.2"
                      textAnchor="middle"
                      x={x}
                      y={y + 2.2}
                    >
                      {Math.round(item.distance)}m
                    </text>
                    {!item.semanticValid && item.missingLinks.length > 0 ? (
                      <text fill="#f59e0b" fontSize="1" textAnchor="middle" x={x} y={y + 3.6}>
                        missing {item.missingLinks.join(", ")}
                      </text>
                    ) : null}
                  </g>
                );
              })
            : null}

          {activeLayers.includes("core_efficiency") && analysis ? (
            <g>
              <circle cx={analysis.corePoint[0]} cy={analysis.corePoint[1]} fill="rgba(192,132,252,0.2)" r="5" stroke="#c084fc" strokeWidth="0.45" />
              {analysis.coreLines.map((line) => (
                <line key={line.id} stroke="#c084fc" strokeOpacity="0.28" strokeWidth="0.25" x1={line.from[0]} x2={line.to[0]} y1={line.from[1]} y2={line.to[1]} />
              ))}
            </g>
          ) : null}

          {analysis?.rooms.map((room) => {
            const [x, y] = room.center;
            return (
              <text fill="#e5edf5" fontSize="1.45" key={`label-${room.roomId}`} textAnchor="middle" x={x} y={y - 0.6} style={{ paintOrder: "stroke", stroke: "#081018", strokeWidth: 0.25 }}>
                {room.name}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeLayers.map((layerId) => {
          const layer = analysisLayers.find((item) => item.id === layerId);
          const legend = layerLegend[layerId];
          const egressNote = egressLegendNote(analysis, layerId);
          return (
            <div className="flex items-center gap-2 rounded border border-line bg-[#0b1118] px-2 py-1 text-xs text-muted" key={layerId}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: legend?.color ?? "#9fb3c8" }} />
              <span>{layer?.label ?? layerId}</span>
              {egressNote ? (
                <span className="text-[11px] text-amber-300/90">{egressNote}</span>
              ) : legend ? (
                <span className="text-[11px] text-muted/80">/ {legend.label}</span>
              ) : null}
            </div>
          );
        })}
      </div>

      {analysis?.egressSummary && (activeLayers.includes("egress_path") || activeLayers.includes("egress_distance")) ? (
        <div className="mt-2 rounded border border-line/80 bg-[#0b1118] px-2 py-2 text-[11px] leading-5 text-muted">
          <div className="text-slate-200">
            Egress routing: {analysis.egressSummary.label}
          </div>
          <div>
            {analysis.egressSummary.validCount} semantic · {analysis.egressSummary.incompleteCount} incomplete ·{" "}
            {analysis.egressSummary.fallbackCount} fallback
          </div>
          {analysis.egressDiagnostics
            .filter((item) => !item.semanticValid)
            .slice(0, 4)
            .map((item) => (
              <div className="text-amber-300/90" key={`egress-legend-${item.roomId}`}>
                {item.roomName}: missing {item.missingLinks.join(", ") || "semantic chain"}
              </div>
            ))}
        </div>
      ) : null}
    </section>
  );
}
