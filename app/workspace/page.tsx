"use client";

import { Suspense } from "react";
import { EvoLabWorkspace } from "@/components/evolab-workspace";
import { WorkspaceBootstrap } from "@/components/workspace/WorkspaceBootstrap";
import { EvoProjectProvider } from "@/lib/project-store";

function WorkspacePageContent() {
  return (
    <EvoProjectProvider>
      <WorkspaceBootstrap />
      <EvoLabWorkspace />
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
