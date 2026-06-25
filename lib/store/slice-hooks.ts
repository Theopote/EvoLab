import { useShallow } from "zustand/react/shallow";
import { useEvoProjectStore } from "@/lib/project-store";
import {
  pickAnalysisActions,
  pickAnalysisSlice,
  pickAnalysisState,
  pickExportActions,
  pickGeometryActions,
  pickProjectActions,
  pickProjectSlice,
  pickProjectState,
  pickReviewActions,
  pickReviewSlice,
  pickReviewState,
  pickSelectionActions,
  pickSelectionEditorSlice,
  pickSelectionSlice,
  pickSelectionState,
  pickSiteActions,
  pickSiteSlice,
  pickSiteState,
  pickWorkspaceSlice
} from "@/lib/store/slice-picks";
import type {
  AnalysisSlice,
  ExportSliceActions,
  GeometrySliceActions,
  ProjectSlice,
  ProjectSliceActions,
  ReviewSlice,
  SelectionEditorSlice,
  SelectionSlice,
  SiteSlice
} from "@/lib/store/slice-types";

function createSliceHook<TSlice>(pick: (state: import("@/lib/store/types").EvoProjectStore) => TSlice) {
  function useSlice(): TSlice;
  function useSlice<T>(selector: (slice: TSlice) => T): T;
  function useSlice<T>(selector?: (slice: TSlice) => T) {
    if (!selector) {
      return useEvoProjectStore(useShallow(pick)) as unknown as T;
    }

    return useEvoProjectStore(useShallow((state) => selector(pick(state))));
  }

  return useSlice;
}

function createActionsHook<TActions>(
  pickActions: (state: import("@/lib/store/types").EvoProjectStore) => TActions
) {
  return () => useEvoProjectStore(useShallow(pickActions));
}

export const useProjectSlice = createSliceHook<ProjectSlice>(pickProjectSlice);
export const useProjectState = createSliceHook(pickProjectState);
export const useProjectActions = createActionsHook<ProjectSliceActions>(pickProjectActions);

export const useSelectionSlice = createSliceHook<SelectionSlice>(pickSelectionSlice);
export const useSelectionState = createSliceHook(pickSelectionState);
export const useSelectionActions = createActionsHook(pickSelectionActions);
export const useSelectionEditorSlice = createSliceHook<SelectionEditorSlice>(pickSelectionEditorSlice);

export const useGeometryActions = createActionsHook<GeometrySliceActions>(pickGeometryActions);

export const useSiteSlice = createSliceHook<SiteSlice>(pickSiteSlice);
export const useSiteState = createSliceHook(pickSiteState);
export const useSiteActions = createActionsHook(pickSiteActions);

export const useAnalysisSlice = createSliceHook<AnalysisSlice>(pickAnalysisSlice);
export const useAnalysisState = createSliceHook(pickAnalysisState);
export const useAnalysisActions = createActionsHook(pickAnalysisActions);

export const useReviewSlice = createSliceHook<ReviewSlice>(pickReviewSlice);
export const useReviewState = createSliceHook(pickReviewState);
export const useReviewActions = createActionsHook(pickReviewActions);

export const useExportActions = createActionsHook<ExportSliceActions>(pickExportActions);

/** Root workspace shell: intentionally broad, but scoped to workspace fields only. */
export const useWorkspaceSlice = createSliceHook(pickWorkspaceSlice);

export {
  pickAnalysisSlice,
  pickAnalysisState,
  pickProjectSlice,
  pickProjectState,
  pickReviewSlice,
  pickReviewState,
  pickSelectionEditorSlice,
  pickSelectionSlice,
  pickSiteSlice,
  pickSiteState,
  pickWorkspaceSlice
} from "@/lib/store/slice-picks";
