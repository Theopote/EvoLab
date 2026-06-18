import { z } from "zod";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const GeneratePlanRequestSchema = z.object({
  outline: z.array(PointSchema).min(3).optional(),
  brief: z.string().optional(),
  projectType: z.string().optional()
});

export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
