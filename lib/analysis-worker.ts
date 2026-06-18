import { computeAnalysis, type AnalysisResult } from "@/lib/analysis-engine";
import type { AnalysisLayerId, PlanVersion } from "@/lib/project-types";

interface AnalysisWorkerRequest {
  requestId: number;
  version: PlanVersion;
  activeLayers: AnalysisLayerId[];
  levelId?: string;
  projectType?: string;
}

export interface AnalysisWorkerResponse {
  requestId: number;
  result?: AnalysisResult;
  error?: string;
}

self.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const { requestId, version, activeLayers, levelId, projectType } = event.data;

  try {
    const result = computeAnalysis(version, activeLayers, { levelId, projectType });
    self.postMessage({ requestId, result } satisfies AnalysisWorkerResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Failed to compute analysis overlays."
    } satisfies AnalysisWorkerResponse);
  }
};
