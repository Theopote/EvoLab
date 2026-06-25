import { create } from "zustand";
import type { Room, Wall } from "@/lib/project-types";

interface EditPreviewState {
  active: boolean;
  previewRooms: Room[] | null;
  previewWalls: Wall[] | null;
  complianceRoomIds: string[];
  dragHint: string | null;
  beginPreview: (baseRooms: Room[]) => void;
  setPreviewRooms: (rooms: Room[], complianceRoomIds?: string[], dragHint?: string | null) => void;
  setPreviewWallGeometry: (
    rooms: Room[],
    walls: Wall[],
    complianceRoomIds?: string[],
    dragHint?: string | null
  ) => void;
  clearPreview: () => void;
  resolveDisplayRooms: (fallback: Room[]) => Room[];
}

export const useEditPreviewStore = create<EditPreviewState>((set, get) => ({
  active: false,
  previewRooms: null,
  previewWalls: null,
  complianceRoomIds: [],
  dragHint: null,
  beginPreview: (baseRooms) =>
    set({
      active: true,
      previewRooms: baseRooms,
      previewWalls: null,
      complianceRoomIds: [],
      dragHint: null
    }),
  setPreviewRooms: (rooms, complianceRoomIds = [], dragHint = null) =>
    set({
      active: true,
      previewRooms: rooms,
      previewWalls: null,
      complianceRoomIds,
      dragHint
    }),
  setPreviewWallGeometry: (rooms, walls, complianceRoomIds = [], dragHint = null) =>
    set({
      active: true,
      previewRooms: rooms,
      previewWalls: walls,
      complianceRoomIds,
      dragHint
    }),
  clearPreview: () =>
    set({
      active: false,
      previewRooms: null,
      previewWalls: null,
      complianceRoomIds: [],
      dragHint: null
    }),
  resolveDisplayRooms: (fallback) => {
    const { previewRooms } = get();
    return previewRooms ?? fallback;
  }
}));
