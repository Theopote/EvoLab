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
  protrusionPrompt: string;
  setPendingStartVertex: (index?: number) => void;
  setBoundarySpan: (span?: BoundarySpanSelection) => void;
  setReshapePrompt: (prompt: string) => void;
  setProtrusionPlacement: (placement?: LocalFormEditStore["protrusionPlacement"]) => void;
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
  protrusionPrompt: "",
  setPendingStartVertex: (index) => set({ pendingStartVertex: index }),
  setBoundarySpan: (span) => set({ boundarySpan: span, pendingStartVertex: undefined }),
  setReshapePrompt: (prompt) => set({ reshapePrompt: prompt }),
  setProtrusionPlacement: (placement) => set({ protrusionPlacement: placement }),
  setProtrusionPrompt: (prompt) => set({ protrusionPrompt: prompt }),
  clearBoundarySpan: () => set({ boundarySpan: undefined, pendingStartVertex: undefined }),
  clearProtrusionPlacement: () => set({ protrusionPlacement: undefined }),
  reset: () =>
    set({
      boundarySpan: undefined,
      pendingStartVertex: undefined,
      reshapePrompt: "",
      protrusionPlacement: undefined,
      protrusionPrompt: ""
    })
}));

export type { RoomProtrusion };
