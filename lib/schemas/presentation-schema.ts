import { z } from "zod";

export const PresentationSlideCopySchema = z.object({
  slideId: z.string().min(4),
  title: z.string().min(4).max(120).optional(),
  subtitle: z.string().min(4).max(160).optional(),
  bullets: z.array(z.string().min(8)).min(1).max(4).optional()
});

export const GenerateStoryboardToolInputSchema = z.object({
  storyArc: z.array(z.string().min(4)).min(4).max(8),
  narrative: z.array(z.string().min(8)).min(4).max(8),
  slideCopy: z.array(PresentationSlideCopySchema).min(4).max(16)
});

export type GenerateStoryboardToolInput = z.infer<typeof GenerateStoryboardToolInputSchema>;
