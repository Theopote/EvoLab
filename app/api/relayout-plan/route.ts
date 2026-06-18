import { NextResponse } from "next/server";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { relayoutPlanVersion } from "@/lib/relayout-version";
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
    return NextResponse.json({ error: "version with rooms is required." }, { status: 400 });
  }

  if (!body.outline || body.outline.length < 3) {
    return NextResponse.json({ error: "outline with at least 3 points is required." }, { status: 400 });
  }

  try {
    const version = normalizePlanVersion(
      relayoutPlanVersion(body.version, {
        siteOutline: body.outline,
        layoutOutline:
          body.layoutOutline && body.layoutOutline.length >= 3 ? body.layoutOutline : body.outline
      })
    );

    return NextResponse.json({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to relayout plan version.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
