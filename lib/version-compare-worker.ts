import { compareVersionsAcrossLevels, type VersionLevelCompareResult } from "@/lib/version-compare-engine";
import type { PlanVersion } from "@/lib/project-types";

export interface VersionCompareWorkerRequest {
  requestId: number;
  versions: PlanVersion[];
  levelIds: string[];
}

export interface VersionCompareWorkerResponse {
  requestId: number;
  results?: VersionLevelCompareResult[];
  error?: string;
}

self.onmessage = (event: MessageEvent<VersionCompareWorkerRequest>) => {
  const { requestId, versions, levelIds } = event.data;

  try {
    const results = compareVersionsAcrossLevels(versions, levelIds);
    self.postMessage({ requestId, results } satisfies VersionCompareWorkerResponse);
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Failed to compare versions."
    } satisfies VersionCompareWorkerResponse);
  }
};
