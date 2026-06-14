import { z } from "zod";
import { CopilotFindingSchema } from "@/lib/schemas/copilot-schema";

export const PointSchema = z.tuple([z.number(), z.number()]);

export const OpeningSchema = z.object({
  wall: z.enum(["north", "south", "east", "west"]),
  position: z.number().min(0).max(1),
  width: z.number().positive()
});

export const RoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum([
    "lobby",
    "corridor",
    "consultation",
    "ward",
    "office",
    "living_room",
    "bedroom",
    "kitchen",
    "bathroom",
    "stair",
    "elevator",
    "shaft",
    "equipment_room",
    "other"
  ]),
  zone: z.enum(["public", "semi_public", "private", "service", "circulation"]),
  polygon: z.array(PointSchema).min(3),
  areaSqm: z.number().positive(),
  ceilingHeight: z.number().min(2.2).max(12),
  orientation: z.string().optional(),
  doors: z.array(OpeningSchema).default([]),
  windows: z.array(OpeningSchema).default([]),
  needsDaylight: z.boolean().optional(),
  needsPlumbing: z.boolean().optional(),
  adjacents: z.array(z.string()).default([])
});

export const PlanVersionMetadataSchema = z.object({
  strategy: z.string().optional(),
  topology: z
    .object({
      circulation: z.string().optional(),
      core: z.string().optional(),
      daylight: z.string().optional(),
      plumbing: z.string().optional()
    })
    .optional()
});

export const PlanVersionDraftSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.string().min(1),
  parentVersionId: z.string().optional(),
  metadata: PlanVersionMetadataSchema.optional(),
  rooms: z.array(RoomSchema).min(1),
  outline: z.array(PointSchema).min(3),
  overallBounds: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }),
  scores: z
    .object({
      areaEfficiency: z.number(),
      circulationScore: z.number(),
      daylightScore: z.number(),
      mepAlignmentScore: z.number(),
      riskCount: z.number()
    })
    .optional()
});

export const GeneratePlanToolInputSchema = z.object({
  versions: z.array(PlanVersionDraftSchema).min(1).max(3)
});

export const AnalyzePlanToolInputSchema = z.object({
  version: PlanVersionDraftSchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([])
});

export const ModifyPlanToolInputSchema = z.object({
  version: PlanVersionDraftSchema,
  findings: z.array(CopilotFindingSchema).default([])
});

export type GeneratePlanToolInput = z.infer<typeof GeneratePlanToolInputSchema>;
export type AnalyzePlanToolInput = z.infer<typeof AnalyzePlanToolInputSchema>;
export type ModifyPlanToolInput = z.infer<typeof ModifyPlanToolInputSchema>;
