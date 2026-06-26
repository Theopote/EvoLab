import { z } from "zod";
import { synthesizeIntakeRecord } from "@/lib/intake/synthesize-intake";
import { apiError, apiOk } from "@/lib/server/api-response";

const RequestSchema = z.object({
  projectName: z.string().optional(),
  materials: z
    .array(
      z.object({
        fileName: z.string(),
        kind: z.enum(["text", "pdf", "image", "url"]),
        content: z.string().optional(),
        url: z.string().optional()
      })
    )
    .min(1)
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const result = await synthesizeIntakeRecord(body);

    return apiOk({
      ...result,
      fallback: "fallback" in result ? result.fallback : false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to synthesize intake.";
    return apiError(message, 400, "SYNTHESIZE_INTAKE_FAILED");
  }
}
