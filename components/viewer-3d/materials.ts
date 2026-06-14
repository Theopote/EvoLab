import type { FunctionZone, RoomType } from "@/lib/project-types";

export interface RoomMaterialSpec {
  color: string;
  opacity: number;
  heightBoost: number;
}

const zoneSpecs: Record<FunctionZone, RoomMaterialSpec> = {
  public: { color: "#5bb6c8", opacity: 0.44, heightBoost: 0.2 },
  semi_public: { color: "#88a86b", opacity: 0.42, heightBoost: 0 },
  private: { color: "#8b7ab8", opacity: 0.38, heightBoost: 0 },
  service: { color: "#b28a58", opacity: 0.46, heightBoost: 0.35 },
  circulation: { color: "#8b99a8", opacity: 0.34, heightBoost: 0.15 }
};

const specialRoomSpecs: Partial<Record<RoomType, RoomMaterialSpec>> = {
  stair: { color: "#d0b45f", opacity: 0.68, heightBoost: 1.1 },
  elevator: { color: "#d0b45f", opacity: 0.68, heightBoost: 1.1 },
  shaft: { color: "#c77c5b", opacity: 0.74, heightBoost: 1.4 },
  equipment_room: { color: "#b28a58", opacity: 0.62, heightBoost: 0.75 }
};

export function getRoomMaterialSpec(type: RoomType, zone: FunctionZone) {
  return specialRoomSpecs[type] ?? zoneSpecs[zone];
}

export const modelPalette = {
  slab: "#d8dde2",
  wall: "#c9d3dc",
  outline: "#5bb6c8",
  grid: "#253447"
};
