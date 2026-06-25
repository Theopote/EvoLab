import { z } from "zod";
import { CopilotFindingSchema } from "@/lib/schemas/copilot-schema";

const FiniteNumberSchema = z.number().finite();

export const PointSchema = z.tuple([FiniteNumberSchema, FiniteNumberSchema]);

export const OpeningSchema = z.object({
  wall: z.enum(["north", "south", "east", "west"]),
  position: FiniteNumberSchema.min(0).max(1),
  width: FiniteNumberSchema.positive()
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
  areaSqm: FiniteNumberSchema.positive(),
  ceilingHeight: FiniteNumberSchema.min(2.2).max(12),
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
    width: FiniteNumberSchema.positive(),
    height: FiniteNumberSchema.positive()
  }),
  scores: z
    .object({
      areaEfficiency: FiniteNumberSchema,
      circulationScore: FiniteNumberSchema,
      daylightScore: FiniteNumberSchema,
      mepAlignmentScore: FiniteNumberSchema,
      egressScore: FiniteNumberSchema.optional(),
      structureFitScore: FiniteNumberSchema.optional(),
      riskCount: FiniteNumberSchema,
      breakdown: z
        .object({
          rulePackId: z.string(),
          programGoalsId: z.string(),
          totalScore: FiniteNumberSchema,
          comparisonHints: z.array(z.string()),
          metrics: z.array(
            z.object({
              id: z.string(),
              label: z.string(),
              score: FiniteNumberSchema,
              weight: FiniteNumberSchema,
              weightedScore: FiniteNumberSchema,
              summary: z.string(),
              evidence: z.array(
                z.object({
                  label: z.string(),
                  value: z.string(),
                  impact: z.enum(["positive", "negative", "neutral"]).optional()
                })
              )
            })
          )
        })
        .optional()
    })
    .optional()
});

export const GeneratePlanToolInputSchema = z.object({
  versions: z.array(PlanVersionDraftSchema).min(1).max(3)
});

export const TopologyRoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: RoomSchema.shape.type,
  zone: RoomSchema.shape.zone,
  targetAreaSqm: FiniteNumberSchema.min(6).max(2000),
  ceilingHeight: FiniteNumberSchema.min(2.2).max(12).optional(),
  needsDaylight: z.boolean().default(false),
  needsPlumbing: z.boolean().default(false),
  preferredEdge: z.enum(["north", "south", "east", "west", "interior"]).optional(),
  adjacencyIds: z.array(z.string()).default([])
});

export const TopologyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relationship: z.enum(["direct", "near", "separated"]).default("direct")
});

export type TopologyEdge = z.infer<typeof TopologyEdgeSchema>;

export const PlanTopologyVersionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  strategy: z.string().min(1),
  topology: z.object({
    circulation: z.string().min(1),
    core: z.string().min(1),
    daylight: z.string().min(1),
    plumbing: z.string().min(1)
  }),
  rooms: z.array(TopologyRoomSchema).min(4).max(40),
  edges: z.array(TopologyEdgeSchema).default([])
});

export const GeneratePlanTopologyToolInputSchema = z.object({
  versions: z.array(PlanTopologyVersionSchema).min(1).max(3)
});

export const AnalyzePlanToolInputSchema = z.object({
  version: PlanVersionDraftSchema,
  confidence: FiniteNumberSchema.min(0).max(1),
  warnings: z.array(z.string()).default([])
});

export const ModifyPlanToolInputSchema = z.object({
  version: PlanVersionDraftSchema,
  findings: z.array(CopilotFindingSchema).default([])
});

export const RefinePlanGeometryToolInputSchema = z.object({
  version: PlanVersionDraftSchema,
  refinementSummary: z.string().optional()
});

export type GeneratePlanToolInput = z.infer<typeof GeneratePlanToolInputSchema>;
export type GeneratePlanTopologyToolInput = z.infer<typeof GeneratePlanTopologyToolInputSchema>;
export type PlanTopologyVersion = z.infer<typeof PlanTopologyVersionSchema>;
export type TopologyRoom = z.infer<typeof TopologyRoomSchema>;
export type AnalyzePlanToolInput = z.infer<typeof AnalyzePlanToolInputSchema>;
export type ModifyPlanToolInput = z.infer<typeof ModifyPlanToolInputSchema>;
export type RefinePlanGeometryToolInput = z.infer<typeof RefinePlanGeometryToolInputSchema>;
