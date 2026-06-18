"use client";

import { useEffect, useReducer } from "react";
import { useEvoProjectStore } from "@/lib/project-store";
import type { PlanVersion } from "@/lib/project-types";

export interface BuildingModelSource {
  version: PlanVersion;
  geometryRevision: number;
}

export function useBuildingModelSource(): BuildingModelSource | null {
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    return useEvoProjectStore.subscribe((state, previousState) => {
      if (
        state.geometryRevision !== previousState.geometryRevision ||
        state.activeVersion?.id !== previousState.activeVersion?.id
      ) {
        rerender();
      }
    });
  }, []);

  const { activeVersion, geometryRevision } = useEvoProjectStore.getState();

  if (!activeVersion) {
    return null;
  }

  return {
    version: activeVersion,
    geometryRevision
  };
}

export function useHasBuildingModel() {
  return useEvoProjectStore((state) => Boolean(state.activeVersion));
}
