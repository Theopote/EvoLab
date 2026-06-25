import type { CodeContext } from "@/lib/building-domain";
import { codeContextFromRulePack } from "@/lib/rules/rule-pack";
import { DEFAULT_TYPOLOGY_ID } from "@/lib/typologies/defaults";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import type { TypologyPackId } from "@/lib/typology/types";

export function resolveCodeContextFromTypology(projectType?: string): CodeContext {
  return codeContextFromRulePack(resolveTypologyPack(projectType).rulePack);
}

export function resolveCodeContextForPackId(packId: TypologyPackId = DEFAULT_TYPOLOGY_ID): CodeContext {
  return codeContextFromRulePack(resolveTypologyPack(packId).rulePack);
}
