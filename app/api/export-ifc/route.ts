import { NextResponse } from "next/server";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import type { PlanVersion } from "@/lib/project-types";

interface ExportIfcRequest {
  version?: PlanVersion;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExportIfcRequest;

  if (!body.version) {
    return NextResponse.json({ error: "version is required for export-ifc." }, { status: 400 });
  }

  return NextResponse.json({
    status: "handoff_ready",
    nextEngine: "IfcOpenShell",
    contentType: "application/json",
    payload: createIfcExportPayload(body.version)
  });
}
