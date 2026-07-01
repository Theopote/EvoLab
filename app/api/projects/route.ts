import { NextResponse } from "next/server";
import { listProjectSummaries, writeProjectSnapshot } from "@/lib/server/project-files";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

export async function GET() {
  const projects = await listProjectSummaries();
  return apiOk({ projects });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as WorkspacePersistedSnapshot | null;

  if (!body?.projectId || !body.project) {
    return apiError("Invalid project snapshot payload.", 400, "INVALID_PAYLOAD");
  }

  await writeProjectSnapshot({
    ...body,
    savedAt: body.savedAt ?? new Date().toISOString()
  });

  return apiOk({ projectId: body.projectId });
}
