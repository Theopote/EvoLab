import { produce } from "immer";
import { fetchSiteContextCommand } from "@/lib/store/commands/fetch-site-context";
import {
  refreshDomainDraft,
  refreshOutlineSyncDraft,
  refreshSiteDerivedDraft
} from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { SiteSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

// AbortController to prevent race conditions in fetchSiteContext
let fetchSiteAbortController: AbortController | null = null;

export const createSiteSlice: StateCreator<EvoProjectStore, [], [], SiteSliceActions> = (set, get) => ({
  setOutline: (outline) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outline = outline;
        refreshSiteDerivedDraft(state);
        refreshOutlineSyncDraft(state);
        refreshDomainDraft(state);
      })
    ),
  setOutlineClosed: (closed) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.outlineClosed = closed;
      })
    ),
  setZoning: (zoning) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.zoning = zoning;
        refreshSiteDerivedDraft(state);
        refreshDomainDraft(state);
      })
    ),
  setSiteAddressQuery: (query) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.siteAddressQuery = query;
      })
    ),
  fetchSiteContext: async (address) => {
    const query = (address ?? get().siteAddressQuery).trim();

    if (!query) {
      set(
        produce<EvoProjectStore>((state) => {
          state.siteError = "Enter a project address first.";
        })
      );
      return;
    }

    // Cancel any in-flight request to prevent race conditions
    if (fetchSiteAbortController) {
      fetchSiteAbortController.abort();
    }
    fetchSiteAbortController = new AbortController();
    const currentController = fetchSiteAbortController;

    set(
      produce<EvoProjectStore>((state) => {
        state.isFetchingSite = true;
        state.siteError = null;
        state.siteAddressQuery = query;
      })
    );

    try {
      const data = await fetchSiteContextCommand(query);

      // Only update state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        set(
          produce<EvoProjectStore>((state) => {
            state.siteContext = data.context;
            refreshDomainDraft(state);
            state.siteError = data.warning ?? null;
            refreshSiteDerivedDraft(state);
          })
        );
      }
    } catch (error) {
      // Only update state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        set(
          produce<EvoProjectStore>((state) => {
            state.siteError = error instanceof Error ? error.message : "Failed to fetch site context.";
          })
        );
      }
    } finally {
      // Only clear loading state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        set(
          produce<EvoProjectStore>((state) => {
            state.isFetchingSite = false;
          })
        );
        // Clear the controller reference if this was the last active one
        if (fetchSiteAbortController === currentController) {
          fetchSiteAbortController = null;
        }
      }
    }
  },
  applySuggestedSiteOutline: () =>
    set(
      produce<EvoProjectStore>((state) => {
        if (!state.siteContext?.suggestedOutline.length) {
          return;
        }

        state.outline = state.siteContext.suggestedOutline;
        state.outlineClosed = true;
        refreshSiteDerivedDraft(state);
      })
    ),
  setShowSiteContextLayer: (visible) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.showSiteContextLayer = visible;
      })
    ),
  setShowEnvironmentOverlay: (visible) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.showEnvironmentOverlay = visible;
      })
    ),
  refreshEnvironmentSurrogate: () =>
    set(
      produce<EvoProjectStore>((state) => {
        refreshSiteDerivedDraft(state);
      })
    )
});
