"use client";

import { useEffect, useReducer } from "react";
import { useInteractionStore } from "@/lib/interaction-store";
import { useEvoProjectStore, useProjectState } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";
import type { FacadeEnvelope } from "@/lib/building-domain";

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
      if (
        state.geometryRevision !== previousState.geometryRevision ||
        state.activeVersion?.id !== previousState.activeVersion?.id ||
        state.project.domain.facadeEnvelope !== previousState.project.domain.facadeEnvelope ||
        state.project.domain.site.orientationDeg !== previousState.project.domain.site.orientationDeg
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

  const { activeVersion, geometryRevision, project } = useEvoProjectStore.getState();
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
