import { normalizePlanVersion } from "@/lib/architecture-model";
import { relayoutPlanVersion } from "@/lib/relayout-version";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { PlanVersion, Point } from "@/lib/project-types";

export const runtime = "nodejs";

interface RelayoutPlanRequest {
  version?: PlanVersion;
  outline?: Point[];
  layoutOutline?: Point[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RelayoutPlanRequest;

  if (!body.version?.rooms?.length) {
    return apiError("version with rooms is required.", 400, "INVALID_PAYLOAD");
  }

  if (!body.outline || body.outline.length < 3) {
    return apiError("outline with at least 3 points is required.", 400, "INVALID_PAYLOAD");
  }

  try {
    const version = normalizePlanVersion(
      relayoutPlanVersion(body.version, {
        siteOutline: body.outline,
        layoutOutline:
          body.layoutOutline && body.layoutOutline.length >= 3 ? body.layoutOutline : body.outline
      })
    );

    return apiOk({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to relayout plan version.";
    return apiError(message, 400, "RELAYOUT_FAILED");
  }
}
