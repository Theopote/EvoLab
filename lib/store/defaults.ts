import { DEFAULT_TYPOLOGY_ID } from "@/lib/typologies/defaults";
import { briefFromTypologyPack } from "@/lib/typologies/domain";
import { DEMO_PROJECT_OUTLINE } from "@/lib/typologies/defaults";
import type { Point } from "@/lib/project-types";

export const defaultOutline: Point[] = DEMO_PROJECT_OUTLINE;

export const defaultBrief = briefFromTypologyPack(DEFAULT_TYPOLOGY_ID);
