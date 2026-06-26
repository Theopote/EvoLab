import { runGeneratePlanPipeline } from "@/lib/generate-plan-pipeline";
import { createMockPlanVersions } from "@/lib/mock-api";
import { apiError, apiOk } from "@/lib/server/api-response";
import { GeneratePlanRequestSchema } from "@/lib/schemas/generate-plan-request-schema";
import type { PlanVersion } from "@/lib/project-types";

interface GeneratePlanResponse {
  versions: PlanVersion[];
  pipeline?: {
    phases: {
      topology: boolean;
      geometry: boolean;
      refinement: boolean;
    };
    topologyCount: number;
    refinedCount: number;
    warnings: string[];
    envelopeApplied?: boolean;
    programApplied?: boolean;
  };
  fallback?: boolean;
  warning?: string;
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsedRequest = GeneratePlanRequestSchema.safeParse(rawBody);

  if (!parsedRequest.success) {
    return apiError("Invalid generate-plan request.", 400, "INVALID_PAYLOAD", parsedRequest.error.message);
  }

  const body = parsedRequest.data;
  const fallback: GeneratePlanResponse = {
    versions: createMockPlanVersions(body.outline, body.projectType)
  };

  try {
    const result = await runGeneratePlanPipeline(body);

    if (result.versions.length === 0) {
      return apiOk({
        ...fallback,
        fallback: true,
        warning: result.meta.warnings.join(" ") || "Pipeline produced no valid plan versions."
      });
    }

    return apiOk({
      versions: result.versions,
      pipeline: result.meta
    });
  } catch (error) {
    return apiOk({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate plan."
    });
  }
}
