"use client";

import { create } from "zustand";
import { createAnalysisSlice } from "@/lib/store/analysis-slice";
import { createExportSlice } from "@/lib/store/export-slice";
import { createGeometrySlice } from "@/lib/store/geometry-slice";
import { createHistorySlice } from "@/lib/store/history-slice";
import { createInitialState } from "@/lib/store/initial-state";
import { createPresentationSlice } from "@/lib/store/presentation-slice";
import { createProjectSlice } from "@/lib/store/project-slice";
import { createReviewSlice } from "@/lib/store/review-slice";
import { createSelectionSlice } from "@/lib/store/selection-slice";
import { createSiteSlice } from "@/lib/store/site-slice";
import type { EvoProjectStore } from "@/lib/store/types";

export const useEvoProjectStore = create<EvoProjectStore>()((...args) =>
  ({
    ...createInitialState(),
    ...createProjectSlice(...args),
    ...createSelectionSlice(...args),
    ...createSiteSlice(...args),
    ...createAnalysisSlice(...args),
    ...createReviewSlice(...args),
    ...createGeometrySlice(...args),
    ...createExportSlice(...args),
    ...createPresentationSlice(...args),
    ...createHistorySlice(...args)
  }) satisfies EvoProjectStore
);

export function getEvoProjectSnapshot() {
  return useEvoProjectStore.getState();
}
