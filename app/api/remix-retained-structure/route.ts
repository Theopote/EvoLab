import { remixPlanWithRetainedStructure } from "@/lib/retained-structure/remix-plan-version";
import { remixParametersFromRecord } from "@/lib/retained-structure/remix-parameters";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { PlanVersion, Point } from "@/lib/project-types";

export const runtime = "nodejs";

interface RemixRetainedStructureRequest {
  version?: PlanVersion;
  outline?: Point[];
  layoutOutline?: Point[];
  options?: Record<string, string | number | boolean>;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RemixRetainedStructureRequest;

  if (!body.version?.rooms?.length) {
    return apiError("version with rooms is required.", 400, "INVALID_PAYLOAD");
  }

  if (!body.outline || body.outline.length < 3) {
    return apiError("outline with at least 3 points is required.", 400, "INVALID_PAYLOAD");
  }

  try {
    const remixOptions = remixParametersFromRecord(body.options);
    const version = remixPlanWithRetainedStructure(body.version, {
      siteOutline: body.outline,
      layoutOutline:
        body.layoutOutline && body.layoutOutline.length >= 3 ? body.layoutOutline : body.outline,
      ...remixOptions
    });

    return apiOk({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remix plan with retained structure.";
    return apiError(message, 400, "REMIX_FAILED");
  }
}
