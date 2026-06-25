import { DEFAULT_TYPOLOGY_ID } from "@/lib/typologies/defaults";
import { TYPOLOGY_PACKS, TYPOLOGY_PACK_BY_ID } from "@/lib/typology/packs";
import type { TypologyPack, TypologyPackId } from "@/lib/typology/types";

function normalizeProjectType(projectType?: string) {
  return projectType?.toLowerCase().trim() ?? "";
}

export function resolveTypologyPackId(projectType?: string): TypologyPackId {
  const normalized = normalizeProjectType(projectType);

  if (!normalized) {
    return DEFAULT_TYPOLOGY_ID;
  }

  const direct = TYPOLOGY_PACK_BY_ID[normalized as TypologyPackId];
  if (direct) {
    return direct.id;
  }

  const matched = TYPOLOGY_PACKS.find((pack) => pack.aliases.includes(normalized));
  return matched?.id ?? DEFAULT_TYPOLOGY_ID;
}

export function resolveTypologyPack(projectType?: string): TypologyPack {
  return TYPOLOGY_PACK_BY_ID[resolveTypologyPackId(projectType)];
}

export function listTypologyPacks() {
  return TYPOLOGY_PACKS.map((pack) => ({ id: pack.id, label: pack.label }));
}
