"use client";

import { type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EvoProjectStore } from "@/lib/store/types";
import { useEvoProjectStore } from "@/lib/store/store";

export type { EvoProjectStore, SelectionType } from "@/lib/store/types";
export {
  useAnalysisActions,
  useAnalysisSlice,
  useAnalysisState,
  useExportActions,
  useFloorPlanEditorState,
  useGeometryActions,
  useProjectActions,
  useProjectSlice,
  useProjectState,
  useReviewActions,
  useReviewSlice,
  useReviewState,
  useSelectionActions,
  useSelectionEditorSlice,
  useSelectionIds,
  useSelectionSlice,
  useSelectionState,
  useSiteActions,
  useSiteSlice,
  useSiteState,
  useWorkspaceSlice
} from "@/lib/store/slice-hooks";
export { resetGeometryChangeBurstForTests } from "@/lib/store/geometry-change-burst";
export { getEvoProjectSnapshot } from "@/lib/store/store";

export function EvoProjectProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useEvoProject(): EvoProjectStore;
export function useEvoProject<T>(selector: (state: EvoProjectStore) => T): T;
export function useEvoProject<T>(selector?: (state: EvoProjectStore) => T) {
  if (!selector) {
    return useEvoProjectStore((state) => state as T);
}

  return useEvoProjectStore(useShallow(selector));
}

export { useEvoProjectStore };
