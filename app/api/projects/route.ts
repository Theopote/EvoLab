import { NextResponse } from "next/server";
import {
  listProjectSummariesFromDisk,
  readProjectSnapshotFromDisk,
  writeProjectSnapshotToDisk
} from "@/lib/server/project-files";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

export async function GET() {
  const projects = await listProjectSummariesFromDisk();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as WorkspacePersistedSnapshot | null;

  if (!body?.projectId || !body.project?.versions?.length) {
    return NextResponse.json({ error: "Invalid project snapshot payload." }, { status: 400 });
  }

  await writeProjectSnapshotToDisk({
    ...body,
    savedAt: body.savedAt ?? new Date().toISOString()
  });

  return NextResponse.json({ ok: true, projectId: body.projectId });
}
