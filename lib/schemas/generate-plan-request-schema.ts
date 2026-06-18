import { z } from "zod";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const ZoningConstraintsSchema = z.object({
  setbackMeters: z.number().min(0).max(50),
  maxHeightMeters: z.number().min(3).max(300),
  maxCoverageRatio: z.number().min(0.1).max(1),
  maxFar: z.number().min(0.1).max(20)
});

const RoomTypeSchema = z.enum([
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
]);

const FunctionZoneSchema = z.enum(["public", "semi_public", "private", "service", "circulation"]);

export const ProgramAdjacencyRuleSchema = z.object({
  spaceId: z.string(),
  targetSpaceId: z.string().optional(),
  targetRoomType: RoomTypeSchema.optional(),
  relationship: z.enum(["must", "must_not", "prefer"])
});

export const ProgramSpaceRequirementSchema = z.object({
  id: z.string(),
  name: z.string(),
  roomType: RoomTypeSchema,
  zone: FunctionZoneSchema,
  minAreaSqm: z.number().optional(),
  maxAreaSqm: z.number().optional(),
  targetAreaSqm: z.number().optional(),
  priority: z.enum(["required", "preferred", "optional"]),
  count: z.number().int().min(1).optional(),
  needsDaylight: z.boolean().optional(),
  needsPlumbing: z.boolean().optional(),
  adjacencyRules: z.array(ProgramAdjacencyRuleSchema).optional()
});

export const ProgramModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  projectType: z.string(),
  targetGrossAreaSqm: z.number().optional(),
  floorCount: z.number().optional(),
  spaces: z.array(ProgramSpaceRequirementSchema),
  notes: z.string().optional()
});

export const DesignBriefSchema = z.object({
  projectType: z.string(),
  description: z.string(),
  floors: z.number().int().min(1).max(60),
  targetArea: z.number().min(1),
  corePreference: z.string(),
  orientationPreference: z.string()
});

export const GeneratePlanRequestSchema = z.object({
  outline: z.array(PointSchema).min(3).optional(),
  brief: z.string().optional(),
  designBrief: DesignBriefSchema.optional(),
  program: ProgramModelSchema.optional(),
  projectType: z.string().optional(),
  floors: z.number().int().min(1).max(60).optional(),
  zoning: ZoningConstraintsSchema.optional()
});

export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
