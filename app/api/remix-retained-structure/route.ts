import { NextResponse } from "next/server";
import { remixPlanWithRetainedStructure } from "@/lib/retained-structure/remix-plan-version";
import type { PlanVersion, Point } from "@/lib/project-types";

export const runtime = "nodejs";

interface RemixRetainedStructureRequest {
  version?: PlanVersion;
  outline?: Point[];
  layoutOutline?: Point[];
  options?: {
    preserveColumns?: boolean;
    preserveCores?: boolean;
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RemixRetainedStructureRequest;

  if (!body.version?.rooms?.length) {
    return NextResponse.json({ error: "version with rooms is required." }, { status: 400 });
  }

  if (!body.outline || body.outline.length < 3) {
    return NextResponse.json({ error: "outline with at least 3 points is required." }, { status: 400 });
  }

  try {
    const version = remixPlanWithRetainedStructure(body.version, {
      siteOutline: body.outline,
      layoutOutline:
        body.layoutOutline && body.layoutOutline.length >= 3 ? body.layoutOutline : body.outline,
      preserveColumns: body.options?.preserveColumns,
      preserveCores: body.options?.preserveCores
    });

    return NextResponse.json({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remix plan with retained structure.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
