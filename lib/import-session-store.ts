import { produce } from "immer";
import { create } from "zustand";
import type { PlanImportSource } from "@/lib/plan-import/types";

export interface ImportReference {
  versionId: string;
  fileName: string;
  sourceType: PlanImportSource;
  previewUrl: string;
  opacity: number;
}

interface ImportSessionState {
  reference?: ImportReference;
  setReference: (reference: ImportReference) => void;
  clearReference: () => void;
  setReferenceOpacity: (opacity: number) => void;
}

export const useImportSessionStore = create<ImportSessionState>((set) => ({
  reference: undefined,
  setReference: (reference) =>
    set(
      produce<ImportSessionState>((state) => {
        state.reference = reference;
      })
    ),
  clearReference: () =>
    set(
      produce<ImportSessionState>((state) => {
        state.reference = undefined;
      })
    ),
  setReferenceOpacity: (opacity) =>
    set(
      produce<ImportSessionState>((state) => {
        if (state.reference) {
          state.reference.opacity = Math.max(0.1, Math.min(1, opacity));
        }
      })
    )
}));
