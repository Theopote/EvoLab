"use client";

import { memo } from "react";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";

export const WorkspaceInspectorRail = memo(function WorkspaceInspectorRail() {
  return (
    <aside className="min-h-0 overflow-auto border-l border-line bg-[#0d141d] p-4">
      <InspectorPanel />
    </aside>
  );
});
