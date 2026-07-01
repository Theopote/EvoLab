"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceBootstrap } from "@/components/workspace/WorkspaceBootstrap";
import { WorkspaceProjectGate } from "@/components/workspace/WorkspaceProjectGate";
import { useWorkspaceHydration } from "@/components/workspace/useWorkspacePersistence";
import { EvoProjectProvider } from "@/lib/project-store";
import type { TypologyPackId } from "@/lib/typology/types";

const EvoLabWorkspace = dynamic(
  () => import("@/components/evolab-workspace").then((module) => ({ default: module.EvoLabWorkspace })),
  { loading: () => <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">加载工作台界面…</div> }
);

const templateIds = new Set<TypologyPackId>(["healthcare", "office", "residential", "school"]);

function WorkspaceHydratedContent({
  projectId,
  skipRestore
}: {
  projectId: string | null;
  skipRestore: boolean;
}) {
  const isReady = useWorkspaceHydration({ preferredProjectId: projectId, skipRestore });

  if (!isReady) {
    return <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">正在加载项目…</div>;
  }

  return (
    <>
      <WorkspaceBootstrap />
      <EvoLabWorkspace />
    </>
  );
}

function WorkspacePageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const template = searchParams.get("template");
  const phase = searchParams.get("phase");
  const skipRestore = Boolean(template && templateIds.has(template as TypologyPackId));
  const hasDirectEntry = Boolean(projectId || skipRestore || phase);

  if (!hasDirectEntry) {
    return <WorkspaceProjectGate />;
  }

  return (
    <EvoProjectProvider>
      <WorkspaceHydratedContent projectId={projectId} skipRestore={skipRestore} />
    </EvoProjectProvider>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-muted">加载工作台…</div>}>
      <WorkspacePageContent />
    </Suspense>
  );
}
