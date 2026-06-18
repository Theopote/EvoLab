import { z } from "zod";

const FiniteNumberSchema = z.number().finite();
const PointSchema = z.tuple([FiniteNumberSchema, FiniteNumberSchema]);

export const RecognizedWallSchema = z.object({
  id: z.string().min(1),
  start: PointSchema,
  end: PointSchema,
  thickness: FiniteNumberSchema.positive().optional(),
  type: z.enum(["external", "internal", "core", "partition"]).optional()
});

export const RecognizedOpeningSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["door", "window", "opening"]),
  center: PointSchema,
  width: FiniteNumberSchema.positive(),
  height: FiniteNumberSchema.positive().optional(),
  sillHeight: FiniteNumberSchema.min(0).optional(),
  wallId: z.string().optional()
});

export const RecognizedRoomPolygonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z
    .enum([
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
    ])
    .default("other"),
  zone: z.enum(["public", "semi_public", "private", "service", "circulation"]).default("private"),
  polygon: z.array(PointSchema).min(3)
});

export const RecognizedRoomLabelSchema = z.object({
  name: z.string().min(1),
  center: PointSchema,
  type: RecognizedRoomPolygonSchema.shape.type.optional(),
  zone: RecognizedRoomPolygonSchema.shape.zone.optional()
});

export const RecognizedDimensionSchema = z.object({
  text: z.string().min(1),
  start: PointSchema,
  end: PointSchema
});

export const RecognizedLevelGraphSchema = z.object({
  name: z.string().min(1),
  elevation: FiniteNumberSchema.optional(),
  walls: z.array(RecognizedWallSchema).default([]),
  openings: z.array(RecognizedOpeningSchema).default([]),
  roomPolygons: z.array(RecognizedRoomPolygonSchema).default([]),
  roomLabels: z.array(RecognizedRoomLabelSchema).default([]),
  dimensionAnnotations: z.array(RecognizedDimensionSchema).default([])
});

export const RecognizedPlanGraphSchema = z.object({
  scale: z
    .object({
      pixelsPerMeter: FiniteNumberSchema.positive().optional(),
      referenceDimensionMeters: FiniteNumberSchema.positive().optional()
    })
    .optional(),
  levels: z.array(RecognizedLevelGraphSchema).min(1),
  warnings: z.array(z.string()).default([])
});

export const AnalyzePlanVisionToolInputSchema = z.object({
  graph: RecognizedPlanGraphSchema,
  confidence: FiniteNumberSchema.min(0).max(1),
  warnings: z.array(z.string()).default([])
});

export type RecognizedPlanGraph = z.infer<typeof RecognizedPlanGraphSchema>;
export type RecognizedLevelGraph = z.infer<typeof RecognizedLevelGraphSchema>;
export type AnalyzePlanVisionToolInput = z.infer<typeof AnalyzePlanVisionToolInputSchema>;
