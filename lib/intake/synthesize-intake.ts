import { z } from "zod";
import { hasAnthropicKey, requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockIntakeSynthesis, type IntakeMaterialInput } from "@/lib/intake/mock-intake-synthesis";
import type { ProjectIntakeRecord } from "@/lib/intake/project-intake-types";

const MaterialSchema = z.object({
  fileName: z.string(),
  kind: z.enum(["text", "pdf", "image", "url"]),
  content: z.string().optional(),
  url: z.string().optional()
});

const RequestSchema = z.object({
  materials: z.array(MaterialSchema).min(1),
  projectName: z.string().optional()
});

const ResponseSchema = z.object({
  summary: z.string(),
  constraints: z.array(z.string()),
  risks: z.array(z.string()),
  opportunities: z.array(z.string()),
  openQuestions: z.array(z.string())
});

export async function synthesizeIntakeRecord(input: {
  materials: IntakeMaterialInput[];
  projectName?: string;
}): Promise<ProjectIntakeRecord & { fallback?: boolean }> {
  const fallback = createMockIntakeSynthesis(input.materials);

  if (!hasAnthropicKey()) {
    return fallback;
  }

  try {
    const result = await requestAnthropicJson<ProjectIntakeRecord>({
      system:
        "You synthesize early-stage architectural project intake notes for schematic design. Return JSON with summary, constraints, risks, opportunities, openQuestions — all in Simplified Chinese, concise and actionable.",
      input: {
        projectName: input.projectName,
        materials: input.materials.map((item) => ({
          fileName: item.fileName,
          kind: item.kind,
          content: item.content?.slice(0, 6000),
          url: item.url
        }))
      }
    });

    const parsed = ResponseSchema.parse(result);
    return {
      ...parsed,
      updatedAt: new Date().toISOString()
    };
  } catch {
    return fallback;
  }
}
