import { z } from "zod";

const FiniteNumberSchema = z.number().finite();
const NormalizedPointSchema = z.tuple([FiniteNumberSchema.min(0).max(1), FiniteNumberSchema.min(0).max(1)]);

export const SheetCornerDetectionToolInputSchema = z.object({
  corners: z.object({
    topLeft: NormalizedPointSchema,
    topRight: NormalizedPointSchema,
    bottomRight: NormalizedPointSchema,
    bottomLeft: NormalizedPointSchema
  }),
  confidence: FiniteNumberSchema.min(0).max(1),
  warnings: z.array(z.string()).default([])
});

export type SheetCornerDetectionResult = z.infer<typeof SheetCornerDetectionToolInputSchema>;
