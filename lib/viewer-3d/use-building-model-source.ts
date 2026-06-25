"use client";

import { useEffect, useReducer } from "react";
import { useInteractionStore } from "@/lib/interaction-store";
import { pickProjectState } from "@/lib/store/slice-picks";
import { useEvoProjectStore } from "@/lib/store/store";
import type { PlanVersion } from "@/lib/project-types";
import type { FacadeEnvelope } from "@/lib/building-domain";
import { useProjectState } from "@/lib/project-store";

export interface BuildingModelSource {
  version: PlanVersion;
  geometryRevision: number;
  facadeEnvelope?: FacadeEnvelope;
  orientationDeg: number;
  showFacadeOverlay: boolean;
}

export function useBuildingModelSource(): BuildingModelSource | null {
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return useEvoProjectStore.subscribe((state, previousState) => {
      const current = pickProjectState(state);
      const previous = pickProjectState(previousState);

      if (
        current.geometryRevision !== previous.geometryRevision ||
        current.activeVersion?.id !== previous.activeVersion?.id ||
        current.project.domain.facadeEnvelope !== previous.project.domain.facadeEnvelope ||
        current.project.domain.site.orientationDeg !== previous.project.domain.site.orientationDeg
      ) {
        rerender();
      }
    });
  }, []);

  useEffect(() => {
    return useInteractionStore.subscribe((state, previousState) => {
      if (state.view3d.showFacadeOverlay !== previousState.view3d.showFacadeOverlay) {
        rerender();
      }
    });
  }, []);

  const { activeVersion, geometryRevision, project } = pickProjectState(useEvoProjectStore.getState());
  const showFacadeOverlay = useInteractionStore.getState().view3d.showFacadeOverlay;

  if (!activeVersion) {
    return null;
  }

  return {
    version: activeVersion,
    geometryRevision,
    facadeEnvelope: project.domain.facadeEnvelope,
    orientationDeg: project.domain.site.orientationDeg,
    showFacadeOverlay
  };
}

export function useHasBuildingModel() {
  return useProjectState((state) => Boolean(state.activeVersion));
}
