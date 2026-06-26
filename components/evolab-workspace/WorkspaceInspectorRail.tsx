"use client";

import { memo, useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { useProjectState, useSelectionSlice } from "@/lib/project-store";
import type { WorkspaceTab } from "@/lib/project-types";

const PARAM_TABS = new Set<WorkspaceTab>(["Site", "Program", "Furniture", "Facade", "Structure", "Massing"]);

export const WorkspaceInspectorRail = memo(function WorkspaceInspectorRail() {
  const { activeTab } = useProjectState((state) => ({ activeTab: state.activeTab }));
  const { selectionType } = useSelectionSlice((state) => ({ selectionType: state.selectionType }));
  const [manualOpen, setManualOpen] = useState<boolean | undefined>(undefined);

  const hasSelection = selectionType !== "none";
  const needsParams = PARAM_TABS.has(activeTab);
  const shouldExpand = hasSelection || needsParams;
  const expanded = manualOpen ?? shouldExpand;

  useEffect(() => {
    if (shouldExpand) {
      setManualOpen(undefined);
    }
  }, [shouldExpand]);

  if (!expanded) {
    return (
      <aside className="flex min-h-0 flex-col items-center border-l border-line bg-[#0d141d] py-3">
        <button
          className="rounded border border-line p-2 text-muted transition hover:border-accent/50 hover:text-accent"
          type="button"
          title="展开检查器"
          aria-label="展开检查器"
          onClick={() => setManualOpen(true)}
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative flex min-h-0 flex-col overflow-auto border-l border-line bg-[#0d141d] p-4">
      <button
        className="absolute right-3 top-3 z-10 rounded border border-line p-1 text-muted transition hover:border-accent/50 hover:text-accent"
        type="button"
        title="收起检查器"
        aria-label="收起检查器"
        onClick={() => setManualOpen(false)}
      >
        <PanelRightClose className="h-3.5 w-3.5" />
      </button>
      <InspectorPanel />
    </aside>
  );
});
