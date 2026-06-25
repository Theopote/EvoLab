import { produce } from "immer";
import type { AnalysisLayerId, MepLayerId } from "@/lib/project-types";
import { generateMepCommand } from "@/lib/store/commands/generate-mep";
import { commitNormalizedVersionDraft } from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { AnalysisSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createAnalysisSlice: StateCreator<EvoProjectStore, [], [], AnalysisSliceActions> = (set, get) => ({
  setActiveAnalysisLayers: (layers) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeAnalysisLayers = layers;
      })
    ),
  setActiveMepLayers: (layers) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.activeMepLayers = layers;
      })
    ),
  generateMep: async () => {
    const activeVersion = get().activeVersion;

    if (!activeVersion || get().isGeneratingMep) {
      return;
    }

    set(
      produce<EvoProjectStore>((state) => {
        state.isGeneratingMep = true;
        state.mepError = null;
      })
    );

    try {
      const data = await generateMepCommand(activeVersion);

      set(
        produce<EvoProjectStore>((state) => {
          const currentVersion = state.activeVersion;

          if (!currentVersion) {
            return;
          }

          commitNormalizedVersionDraft(state, {
            ...currentVersion,
            mep: data.mep,
            scores: currentVersion.scores
              ? {
                  ...currentVersion.scores,
                  mepAlignmentScore: Math.min(100, currentVersion.scores.mepAlignmentScore + 4)
                }
              : currentVersion.scores
          });

          if (data.warning) {
            state.mepError = `Fallback MEP generated: ${data.warning}`;
          }
        })
      );
    } catch (error) {
      set(
        produce<EvoProjectStore>((state) => {
          state.mepError = error instanceof Error ? error.message : "Failed to generate MEP.";
        })
      );
    } finally {
      set(
        produce<EvoProjectStore>((state) => {
          state.isGeneratingMep = false;
        })
      );
    }
  }
});
