import { produce } from "immer";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { commitNormalizedVersionDraft } from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { ExportSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createExportSlice: StateCreator<EvoProjectStore, [], [], ExportSliceActions> = (set) => ({
  openModelForVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version), true);
        state.activeTab = "Model";
      })
    ),
  refineVersion: (version) =>
    set(
      produce<EvoProjectStore>((state) => {
        commitNormalizedVersionDraft(state, normalizePlanVersion(version), true);
        state.activeTab = "Plan";
      })
    ),
  returnToPlanGeneration: () =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeTab = "Plan";
      })
    )
});
