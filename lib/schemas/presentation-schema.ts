import { z } from "zod";

export const GenerateStoryboardToolInputSchema = z.object({
  narrative: z.array(z.string().min(8)).min(4).max(8),
  storyArc: z.array(z.string().min(4)).min(4).max(8)
});

export type GenerateStoryboardToolInput = z.infer<typeof GenerateStoryboardToolInputSchema>;
