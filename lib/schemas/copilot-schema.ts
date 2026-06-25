import { z } from "zod";

export const CopilotActionSchema = z.object({
  id: z.enum([
    "optimize-egress",
    "apply-compliance-fix",
    "generate-flow-diagram",
    "layout-shafts",
    "generate-massing",
    "recalculate-areas",
    "select-room",
    "switch-tab",
    "select-version",
    "regenerate-plan"
  ]),
  label: z.string().min(1),
  payload: z.string().optional()
});

export const CopilotFindingSchema = z.object({
  id: z.string().min(1),
  tone: z.enum(["info", "warning", "success"]),
  text: z.string().min(1),
  sub: z.string().optional(),
  actions: z.array(CopilotActionSchema).optional()
});
