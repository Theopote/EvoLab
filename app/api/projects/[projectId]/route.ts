import { NextResponse } from "next/server";
import {
  deleteProjectSnapshotFromDisk,
  readProjectSnapshotFromDisk,
  writeProjectSnapshotToDisk
} from "@/lib/server/project-files";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

interface RouteContext {
  params: { projectId: string };
}

export async function GET(_request: Request, context: RouteContext) {
  const snapshot = await readProjectSnapshotFromDisk(context.params.projectId);

  if (!snapshot) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

export async function PUT(request: Request, context: RouteContext) {
  const body = (await request.json().catch(() => null)) as WorkspacePersistedSnapshot | null;

  if (!body?.project?.versions?.length) {
    return NextResponse.json({ error: "Invalid project snapshot payload." }, { status: 400 });
  }

  if (body.projectId !== context.params.projectId) {
    return NextResponse.json({ error: "Project id mismatch." }, { status: 400 });
  }

  await writeProjectSnapshotToDisk({
    ...body,
    savedAt: new Date().toISOString()
  });

  return NextResponse.json({ ok: true, projectId: body.projectId, savedAt: body.savedAt });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await deleteProjectSnapshotFromDisk(context.params.projectId);
  return NextResponse.json({ ok: true });
}
