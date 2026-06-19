import { z } from "zod";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const LockedStructuralPositionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["column", "shear_wall", "mep_shaft", "core"]),
  position: PointSchema,
  label: z.string().optional()
});

export const StructuralConstraintSetSchema = z.object({
  lockedPositions: z.array(LockedStructuralPositionSchema).min(1),
  toleranceM: z.number().positive().optional()
});
