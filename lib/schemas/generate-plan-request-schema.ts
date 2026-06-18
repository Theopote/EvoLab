import { z } from "zod";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const ZoningConstraintsSchema = z.object({
  setbackMeters: z.number().min(0).max(50),
  maxHeightMeters: z.number().min(3).max(300),
  maxCoverageRatio: z.number().min(0.1).max(1),
  maxFar: z.number().min(0.1).max(20)
});

export const GeneratePlanRequestSchema = z.object({
  outline: z.array(PointSchema).min(3).optional(),
  brief: z.string().optional(),
  projectType: z.string().optional(),
  floors: z.number().int().min(1).max(60).optional(),
  zoning: ZoningConstraintsSchema.optional()
});

export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
