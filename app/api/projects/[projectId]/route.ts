import {
  deleteProjectSnapshot,
  readProjectSnapshot,
  writeProjectSnapshot
} from "@/lib/server/project-files";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

interface RouteContext {
  params: { projectId: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const snapshot = await readProjectSnapshot(context.params.projectId);

  if (!snapshot) {
    return apiError("Project not found.", 404, "NOT_FOUND");
  }

  return apiOk(snapshot);
}

export async function PUT(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as WorkspacePersistedSnapshot | null;

  if (!body?.projectId || !body.project) {
    return apiError("Invalid project snapshot payload.", 400, "INVALID_PAYLOAD");
  }

  if (body.projectId !== context.params.projectId) {
    return apiError("Project id mismatch.", 400, "PROJECT_ID_MISMATCH");
  }

  const savedAt = new Date().toISOString();

  await writeProjectSnapshot({
    ...body,
    savedAt
  });

  return apiOk({ projectId: body.projectId, savedAt });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await deleteProjectSnapshot(context.params.projectId);
  return apiOk({ projectId: context.params.projectId });
}
