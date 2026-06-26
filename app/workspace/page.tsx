"use client";

import { EvoLabWorkspace } from "@/components/evolab-workspace";
import { WorkspaceBootstrap } from "@/components/workspace/WorkspaceBootstrap";
import { EvoProjectProvider } from "@/lib/project-store";

export default function WorkspacePage() {
  return (
    <EvoProjectProvider>
      <WorkspaceBootstrap />
      <EvoLabWorkspace />
    </EvoProjectProvider>
  );
}
