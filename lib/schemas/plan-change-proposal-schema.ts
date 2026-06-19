import { z } from "zod";
import { CopilotFindingSchema } from "@/lib/schemas/copilot-schema";

const DirectionSchema = z.enum(["north", "south", "east", "west"]);

export const PlanChangeConstraintSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  severity: z.enum(["hard", "soft"]).default("hard")
});

const BaseOperationSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  rationale: z.string().optional(),
  targetRoomIds: z.array(z.string()).default([])
});

export const MoveCoreOperationSchema = BaseOperationSchema.extend({
  type: z.literal("move_core"),
  direction: DirectionSchema,
  distanceMeters: z.number().positive().max(30)
});

export const ShiftRoomsOperationSchema = BaseOperationSchema.extend({
  type: z.literal("shift_rooms"),
  roomIds: z.array(z.string()).min(1),
  dx: z.number().min(-30).max(30),
  dy: z.number().min(-30).max(30)
});

export const WidenCorridorOperationSchema = BaseOperationSchema.extend({
  type: z.literal("widen_corridor"),
  corridorIds: z.array(z.string()).optional(),
  extraWidthMeters: z.number().positive().max(5),
  side: z.enum(["left", "right", "both"]).default("both")
});

export const AlignWetRoomsOperationSchema = BaseOperationSchema.extend({
  type: z.literal("align_wet_rooms"),
  roomIds: z.array(z.string()).optional(),
  nearShaftId: z.string().optional(),
  maxDistanceMeters: z.number().positive().max(20).default(12)
});

export const UpdateRoomOperationSchema = BaseOperationSchema.extend({
  type: z.literal("update_room"),
  roomId: z.string().min(1),
  patch: z
    .object({
      name: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      zone: z.string().min(1).optional()
    })
    .refine((patch) => Object.keys(patch).length > 0, "patch must include at least one field")
});

export const OptimizeEgressOperationSchema = BaseOperationSchema.extend({
  type: z.literal("optimize_egress"),
  note: z.string().optional()
});

export const SplitRoomOperationSchema = BaseOperationSchema.extend({
  type: z.literal("split_room"),
  roomId: z.string().min(1),
  splitAxis: z.enum(["horizontal", "vertical"]),
  splitRatio: z.number().min(0.15).max(0.85).default(0.5),
  secondRoomId: z.string().min(1).optional(),
  secondRoomName: z.string().min(1)
});

export const AddOpeningOperationSchema = BaseOperationSchema.extend({
  type: z.literal("add_opening"),
  roomId: z.string().min(1),
  openingKind: z.enum(["door", "window"]),
  wall: z.enum(["north", "south", "east", "west"]),
  position: z.number().min(0.05).max(0.95).default(0.5),
  width: z.number().positive().max(6)
});

export const ResizeOpeningOperationSchema = BaseOperationSchema.extend({
  type: z.literal("resize_opening"),
  roomId: z.string().min(1),
  openingKind: z.enum(["door", "window"]),
  openingIndex: z.number().int().min(0).default(0),
  width: z.number().positive().max(6)
});

export const MergeRoomOperationSchema = BaseOperationSchema.extend({
  type: z.literal("merge_room"),
  primaryRoomId: z.string().min(1),
  secondaryRoomId: z.string().min(1),
  mergedRoomId: z.string().min(1).optional(),
  mergedRoomName: z.string().min(1).optional()
});

const PointTupleSchema = z.tuple([z.number(), z.number()]);

export const UpdateRoomPolygonOperationSchema = BaseOperationSchema.extend({
  type: z.literal("update_room_polygon"),
  roomId: z.string().min(1),
  polygon: z.array(PointTupleSchema).min(3).max(32)
});

export const PlanOperationSchema = z.discriminatedUnion("type", [
  MoveCoreOperationSchema,
  ShiftRoomsOperationSchema,
  WidenCorridorOperationSchema,
  AlignWetRoomsOperationSchema,
  UpdateRoomOperationSchema,
  OptimizeEgressOperationSchema,
  SplitRoomOperationSchema,
  MergeRoomOperationSchema,
  AddOpeningOperationSchema,
  ResizeOpeningOperationSchema,
  UpdateRoomPolygonOperationSchema
]);

export const PlanChangeProposalSchema = z.object({
  intent: z.string().min(1),
  constraints: z.array(PlanChangeConstraintSchema).default([]),
  targetElementIds: z.array(z.string()).default([]),
  operations: z.array(PlanOperationSchema).min(1).max(12)
});

export const ProposePlanChangesToolInputSchema = z.object({
  proposal: PlanChangeProposalSchema,
  findings: z.array(CopilotFindingSchema).default([])
});

export type PlanChangeConstraint = z.infer<typeof PlanChangeConstraintSchema>;
export type PlanOperation = z.infer<typeof PlanOperationSchema>;
export type PlanChangeProposal = z.infer<typeof PlanChangeProposalSchema>;
export type ProposePlanChangesToolInput = z.infer<typeof ProposePlanChangesToolInputSchema>;
