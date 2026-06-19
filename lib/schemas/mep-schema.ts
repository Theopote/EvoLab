import { z } from "zod";
import { CopilotFindingSchema } from "@/lib/schemas/copilot-schema";
import { PointSchema } from "@/lib/schemas/plan-version-schema";

export const MepSystemTypeSchema = z.enum([
  "hvac",
  "plumbing_supply",
  "plumbing_drain",
  "electrical",
  "elv",
  "fire"
]);

export const MepLayoutSchema = z.object({
  shafts: z.array(
    z.object({
      id: z.string().min(1),
      position: PointSchema,
      systems: z.array(MepSystemTypeSchema).min(1),
      levelIds: z.array(z.string()).optional()
    })
  ),
  routes: z.array(
    z.object({
      id: z.string().min(1),
      system: MepSystemTypeSchema,
      path: z.array(PointSchema).min(2),
      connectsRoomIds: z.array(z.string()),
      levelId: z.string().optional()
    })
  ),
  strategy: z
    .object({
      systemConcept: z.string().min(1),
      shaftLogic: z.string().min(1),
      routingLogic: z.string().min(1),
      assumptions: z.array(z.string()).default([])
    })
    .optional()
});

export const GenerateMepToolInputSchema = z.object({
  mep: MepLayoutSchema,
  findings: z.array(CopilotFindingSchema).default([])
});

export type GenerateMepToolInput = z.infer<typeof GenerateMepToolInputSchema>;
