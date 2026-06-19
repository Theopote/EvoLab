import { z } from "zod";
import { CopilotFindingSchema } from "@/lib/schemas/copilot-schema";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const BoundarySpanSelectionSchema = z.object({
  roomId: z.string().min(1),
  startVertexIndex: z.number().int().min(0),
  endVertexIndex: z.number().int().min(0),
  useLongArc: z.boolean().default(false),
  anchorBefore: PointSchema,
  anchorAfter: PointSchema,
  currentPoints: z.array(PointSchema).min(1)
});

export const ReshapeBoundaryToolInputSchema = z.object({
  points: z.array(PointSchema).min(2),
  findings: z.array(CopilotFindingSchema).default([])
});

export const RoomProtrusionSchema = z.object({
  type: z.enum(["bay_window", "niche", "balcony"]),
  footprint: z.array(PointSchema).min(3),
  depthM: z.number().positive().max(3),
  sillHeightM: z.number().min(0).max(3).optional(),
  headroomM: z.number().min(1.8).max(4).optional()
});

export const AddProtrusionToolInputSchema = z.object({
  protrusion: RoomProtrusionSchema,
  findings: z.array(CopilotFindingSchema).default([])
});
