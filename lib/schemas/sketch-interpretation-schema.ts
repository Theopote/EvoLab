import { z } from "zod";
import { FiniteNumberSchema } from "@/lib/schemas/plan-version-schema";

const PointSchema = z.tuple([FiniteNumberSchema, FiniteNumberSchema]);

const OpeningSchema = z.object({
  id: z.string(),
  type: z.enum(["door", "window"]),
  wall: z.enum(["north", "south", "east", "west"]),
  width: FiniteNumberSchema,
  height: FiniteNumberSchema.optional(),
  offset: FiniteNumberSchema.optional()
});

const SketchRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  zone: z.string(),
  polygon: z.array(PointSchema).min(3),
  areaSqm: FiniteNumberSchema,
  ceilingHeight: FiniteNumberSchema.optional(),
  doors: z.array(OpeningSchema).optional(),
  windows: z.array(OpeningSchema).optional(),
  adjacents: z.array(z.string()).optional()
});

export const RecognizedSketchRoomSchema = z.object({
  room: SketchRoomSchema,
  confidence: z.enum(["high", "needs_review"]),
  reasons: z.array(z.string()).optional()
});

export const SketchInterpretationToolInputSchema = z.object({
  recognizedRooms: z.array(RecognizedSketchRoomSchema),
  warnings: z.array(z.string()).optional()
});

export type RecognizedSketchRoom = z.infer<typeof RecognizedSketchRoomSchema>;
export type SketchInterpretationToolInput = z.infer<typeof SketchInterpretationToolInputSchema>;
