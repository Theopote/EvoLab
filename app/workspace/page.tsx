"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { WorkspaceBootstrap } from "@/components/workspace/WorkspaceBootstrap";
import { EvoProjectProvider } from "@/lib/project-store";

const EvoLabWorkspace = dynamic(
  () => import("@/components/evolab-workspace").then((module) => ({ default: module.EvoLabWorkspace })),
  { loading: () => <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">加载工作台界面…</div> }
);

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
