"use client";

import { EvoLabWorkspace } from "@/components/evolab-workspace";
import { EvoProjectProvider } from "@/lib/project-store";

export default function WorkspacePage() {
  return (
    <EvoProjectProvider>
      <EvoLabWorkspace />
    </EvoProjectProvider>
  );
}
