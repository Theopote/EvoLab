"use client";

import { type ReactNode } from "react";
import { create } from "zustand";
import { createAnalysisSlice } from "@/lib/store/analysis-slice";
import { createExportSlice } from "@/lib/store/export-slice";
import { createGeometrySlice } from "@/lib/store/geometry-slice";
import { createInitialState } from "@/lib/store/initial-state";
import { createProjectSlice } from "@/lib/store/project-slice";
import { createReviewSlice } from "@/lib/store/review-slice";
import { createSelectionSlice } from "@/lib/store/selection-slice";
import { createSiteSlice } from "@/lib/store/site-slice";
import type { EvoProjectStore } from "@/lib/store/types";

export type { EvoProjectStore, SelectionType } from "@/lib/store/types";
export { resetGeometryChangeBurstForTests } from "@/lib/store/geometry-change-burst";

export const useEvoProjectStore = create<EvoProjectStore>()((...args) =>
  ({
    ...createInitialState(),
    ...createProjectSlice(...args),
    ...createSelectionSlice(...args),
    ...createSiteSlice(...args),
    ...createAnalysisSlice(...args),
    ...createReviewSlice(...args),
    ...createGeometrySlice(...args),
    ...createExportSlice(...args)
  }) satisfies EvoProjectStore
);

export function EvoProjectProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function getEvoProjectSnapshot() {
  return useEvoProjectStore.getState();
}

export function useEvoProject(): EvoProjectStore;
export function useEvoProject<T>(selector: (state: EvoProjectStore) => T): T;
export function useEvoProject<T>(selector?: (state: EvoProjectStore) => T) {
  return useEvoProjectStore(selector ?? ((state) => state as T));
}
