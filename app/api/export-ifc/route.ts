import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { PlanVersion } from "@/lib/project-types";

interface ExportIfcRequest {
  version?: PlanVersion;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExportIfcRequest;

  if (!body.version) {
    return apiError("version is required for export-ifc.", 400, "INVALID_PAYLOAD");
  }

  return apiOk({
    status: "handoff_ready",
    nextEngine: "IfcOpenShell",
    contentType: "application/json",
    payload: createIfcExportPayload(body.version)
  });
}
