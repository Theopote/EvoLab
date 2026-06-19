import { produce } from "immer";
import { create } from "zustand";

export type ActiveTool =
  | "select"
  | "outline"
  | "upload"
  | "flow"
  | "model"
  | "trace"
  | "inpaint"
  | "sketch_input"
  | "reshape_boundary"
  | "add_protrusion";

interface View3DState {
  frameloop: "always" | "demand";
  bvhEnabled: boolean;
}

interface InteractionState {
  activeTool: ActiveTool;
  selectedRoomId?: string;
  hoveredRoomId?: string;
  explodeFactor: number;
  view3d: View3DState;
  setActiveTool: (tool: ActiveTool) => void;
  selectRoom: (roomId?: string) => void;
  hoverRoom: (roomId?: string) => void;
  clearSelection: () => void;
  setExplodeFactor: (factor: number) => void;
  setView3D: (view: Partial<View3DState>) => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  activeTool: "select",
  selectedRoomId: undefined,
  hoveredRoomId: undefined,
  explodeFactor: 0,
  view3d: {
    frameloop: "demand",
    bvhEnabled: true
  },
  setActiveTool: (tool) =>
    set(
      produce<InteractionState>((state) => {
        state.activeTool = tool;
      })
    ),
  selectRoom: (roomId) =>
    set(
      produce<InteractionState>((state) => {
        state.selectedRoomId = roomId;
      })
    ),
  hoverRoom: (roomId) =>
    set(
      produce<InteractionState>((state) => {
        state.hoveredRoomId = roomId;
      })
    ),
  clearSelection: () =>
    set(
      produce<InteractionState>((state) => {
        state.selectedRoomId = undefined;
        state.hoveredRoomId = undefined;
      })
    ),
  setExplodeFactor: (factor) =>
    set(
      produce<InteractionState>((state) => {
        state.explodeFactor = Math.max(0, Math.min(1, factor));
      })
    ),
  setView3D: (view) =>
    set(
      produce<InteractionState>((state) => {
        state.view3d = { ...state.view3d, ...view };
      })
    )
}));

export function getInteractionSnapshot() {
  return useInteractionStore.getState();
}
