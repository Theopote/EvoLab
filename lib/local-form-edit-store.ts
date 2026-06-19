import { create } from "zustand";
import type { BoundarySpanSelection } from "@/lib/boundary-span-select";
import type { RoomProtrusion } from "@/lib/project-types";

interface LocalFormEditStore {
  boundarySpan?: BoundarySpanSelection;
  pendingStartVertex?: number;
  reshapePrompt: string;
  protrusionPlacement?: {
    wallId: string;
    positionOnEdge: number;
    widthM: number;
  };
  protrusionWidthM: number;
  protrusionPrompt: string;
  setPendingStartVertex: (index?: number) => void;
  setBoundarySpan: (span?: BoundarySpanSelection) => void;
  setReshapePrompt: (prompt: string) => void;
  setProtrusionPlacement: (placement?: LocalFormEditStore["protrusionPlacement"]) => void;
  setProtrusionWidthM: (widthM: number) => void;
  setProtrusionPrompt: (prompt: string) => void;
  clearBoundarySpan: () => void;
  clearProtrusionPlacement: () => void;
  reset: () => void;
}

export const useLocalFormEditStore = create<LocalFormEditStore>((set) => ({
  boundarySpan: undefined,
  pendingStartVertex: undefined,
  reshapePrompt: "",
  protrusionPlacement: undefined,
  protrusionWidthM: 1.5,
  protrusionPrompt: "",
  setPendingStartVertex: (index) => set({ pendingStartVertex: index }),
  setBoundarySpan: (span) => set({ boundarySpan: span, pendingStartVertex: undefined }),
  setReshapePrompt: (prompt) => set({ reshapePrompt: prompt }),
  setProtrusionPlacement: (placement) => set({ protrusionPlacement: placement }),
  setProtrusionWidthM: (widthM) => set({ protrusionWidthM: widthM }),
  setProtrusionPrompt: (prompt) => set({ protrusionPrompt: prompt }),
  clearBoundarySpan: () => set({ boundarySpan: undefined, pendingStartVertex: undefined }),
  clearProtrusionPlacement: () => set({ protrusionPlacement: undefined }),
  reset: () =>
    set({
      boundarySpan: undefined,
      pendingStartVertex: undefined,
      reshapePrompt: "",
      protrusionPlacement: undefined,
      protrusionWidthM: 1.5,
      protrusionPrompt: ""
    })
}));

export type { RoomProtrusion };
