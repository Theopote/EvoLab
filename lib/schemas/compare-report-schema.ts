import { z } from "zod";

const CompareReportVersionRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  isActive: z.boolean(),
  isRecommended: z.boolean(),
  roomCount: z.number(),
  grossArea: z.number(),
  netArea: z.number(),
  totalScore: z.number(),
  areaEfficiency: z.number(),
  circulationScore: z.number(),
  daylightScore: z.number(),
  mepAlignmentScore: z.number(),
  riskCount: z.number(),
  strategy: z.string().optional()
});

export const CompareReportSchema = z.object({
  projectName: z.string().min(1),
  projectType: z.string().min(1),
  generatedAt: z.string().min(1),
  levelName: z.string().optional(),
  pinnedVersionLabels: z.array(z.string()).min(2),
  versions: z.array(CompareReportVersionRowSchema).min(2),
  recommendation: z.object({
    versionId: z.string(),
    versionLabel: z.string(),
    summary: z.string(),
    explanations: z.array(z.string()),
    comparedAgainstLabel: z.string(),
    leftTotal: z.number(),
    rightTotal: z.number()
  }),
  diff: z
    .object({
      baseLabel: z.string(),
      previewLabel: z.string(),
      added: z.number(),
      modified: z.number(),
      removed: z.number(),
      svg: z.string()
    })
    .optional(),
  metricTable: z.object({
    headers: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1)
  })
});

export type CompareReportPayload = z.infer<typeof CompareReportSchema>;
