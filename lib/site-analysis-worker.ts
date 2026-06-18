import { computeEnvironmentSurrogate } from "@/lib/environment-surrogate";
import type { EnvironmentSurrogate, SiteBuildingFootprint } from "@/lib/site-types";
import type { Point } from "@/lib/project-types";

interface SiteAnalysisWorkerRequest {
  requestId: number;
  outline: Point[];
  buildings: SiteBuildingFootprint[];
  gridSize?: number;
}

export interface SiteAnalysisWorkerResponse {
  requestId: number;
  result?: EnvironmentSurrogate;
  error?: string;
}

self.onmessage = (event: MessageEvent<SiteAnalysisWorkerRequest>) => {
  const { requestId, outline, buildings, gridSize } = event.data;

  try {
    const result = computeEnvironmentSurrogate({ outline, buildings, gridSize });
    self.postMessage({ requestId, result } satisfies SiteAnalysisWorkerResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Failed to compute environment surrogate."
    } satisfies SiteAnalysisWorkerResponse);
  }
};
