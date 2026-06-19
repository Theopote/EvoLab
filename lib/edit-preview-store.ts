import { create } from "zustand";
import type { Room } from "@/lib/project-types";

interface EditPreviewState {
  active: boolean;
  previewRooms: Room[] | null;
  complianceRoomIds: string[];
  beginPreview: (baseRooms: Room[]) => void;
  setPreviewRooms: (rooms: Room[], complianceRoomIds?: string[]) => void;
  clearPreview: () => void;
  resolveDisplayRooms: (fallback: Room[]) => Room[];
}

export const useEditPreviewStore = create<EditPreviewState>((set, get) => ({
  active: false,
  previewRooms: null,
  complianceRoomIds: [],
  beginPreview: (baseRooms) =>
    set({
      active: true,
      previewRooms: baseRooms,
      complianceRoomIds: []
    }),
  setPreviewRooms: (rooms, complianceRoomIds = []) =>
    set({
      active: true,
      previewRooms: rooms,
      complianceRoomIds
    }),
  clearPreview: () =>
    set({
      active: false,
      previewRooms: null,
      complianceRoomIds: []
    }),
  resolveDisplayRooms: (fallback) => {
    const { previewRooms } = get();
    return previewRooms ?? fallback;
  }
}));
