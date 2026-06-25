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

export const PresentationSlideSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  bullets: z.array(z.string()),
  svg: z.string().optional(),
  images: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        dataUrl: z.string()
      })
    )
    .optional(),
  table: z
    .object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string()))
    })
    .optional()
});

export const PresentationDeckSchema = z.object({
  projectName: z.string().min(1),
  projectType: z.string().min(1),
  versionLabel: z.string().min(1),
  generatedAt: z.string().min(1),
  templateId: z.enum(["classic", "studio"]).optional(),
  storyArc: z.array(z.string()).optional(),
  designNarrative: z.array(z.string()).optional(),
  slides: z.array(PresentationSlideSchema).min(1)
});

export type GenerateStoryboardToolInput = z.infer<typeof GenerateStoryboardToolInputSchema>;
