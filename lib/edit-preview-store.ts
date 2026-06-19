import { create } from "zustand";
import type { Room } from "@/lib/project-types";

interface EditPreviewState {
  active: boolean;
  previewRooms: Room[] | null;
  complianceRoomIds: string[];
  dragHint: string | null;
  beginPreview: (baseRooms: Room[]) => void;
  setPreviewRooms: (rooms: Room[], complianceRoomIds?: string[], dragHint?: string | null) => void;
  clearPreview: () => void;
  resolveDisplayRooms: (fallback: Room[]) => Room[];
}

export const useEditPreviewStore = create<EditPreviewState>((set, get) => ({
  active: false,
  previewRooms: null,
  complianceRoomIds: [],
  dragHint: null,
  beginPreview: (baseRooms) =>
    set({
      active: true,
      previewRooms: baseRooms,
      complianceRoomIds: [],
      dragHint: null
    }),
  setPreviewRooms: (rooms, complianceRoomIds = [], dragHint = null) =>
    set({
      active: true,
      previewRooms: rooms,
      complianceRoomIds,
      dragHint
    }),
  clearPreview: () =>
    set({
      active: false,
      previewRooms: null,
      complianceRoomIds: [],
      dragHint: null
    }),
  resolveDisplayRooms: (fallback) => {
    const { previewRooms } = get();
    return previewRooms ?? fallback;
  }
}));
