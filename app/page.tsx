"use client";

import { EvoLabWorkspace } from "@/components/evolab-workspace";
import { EvoProjectProvider } from "@/lib/project-store";

export default function Home() {
  return (
    <EvoProjectProvider>
      <EvoLabWorkspace />
    </EvoProjectProvider>
  );
}
