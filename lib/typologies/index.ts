export { DEFAULT_TYPOLOGY_ID, DEMO_PROJECT_OUTLINE } from "@/lib/typologies/defaults";
export { resolveCodeContextFromTypology, resolveCodeContextForPackId } from "@/lib/typologies/code-context";
export { applyTypologyPackToDomain, briefFromTypologyPack } from "@/lib/typologies/domain";
export { createDemoProjectData } from "@/lib/typologies/demo-project";
export { listFurniturePresets, type FurniturePreset } from "@/lib/typologies/furniture";
export { resolveSchedulePreset, type SchedulePreset } from "@/lib/typologies/schedules";
export {
  listTypologyPacks,
  resolveTypologyPack,
  resolveTypologyPackId
} from "@/lib/typology/resolve";
export {
  healthcareTypologyPack,
  officeTypologyPack,
  residentialTypologyPack,
  schoolTypologyPack,
  TYPOLOGY_PACKS,
  TYPOLOGY_PACK_BY_ID
} from "@/lib/typology/packs";
export type { TypologyPack, TypologyPackId } from "@/lib/typology/types";
