import { z } from "zod";

const FiniteNumberSchema = z.number().finite();
const PointSchema = z.tuple([FiniteNumberSchema, FiniteNumberSchema]);

const OpeningSchema = z.object({
  wall: z.enum(["north", "south", "east", "west"]),
  position: FiniteNumberSchema.min(0).max(1),
  width: FiniteNumberSchema.positive()
});

const SketchRoomSchema = z.object({
  id: z.string(),
  name: z.string(),
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
