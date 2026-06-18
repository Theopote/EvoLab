"use client";

import {
  analyzeSubviewForTab,
  deliverSubviewForTab,
  schemeSubviewForTab,
  tabForAnalyzeSubview,
  tabForDeliverSubview,
  tabForSchemeSubview,
  workflowPhaseDefinitions,
  type AnalyzeSubview,
  type DeliverSubview,
  type SchemeSubview,
  type WorkflowPhase
} from "@/lib/workflow-phases";
import type { WorkspaceTab } from "@/lib/project-types";

interface PhaseSubNavProps {
  phase: WorkflowPhase;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const schemeItems: { id: SchemeSubview; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "massing", label: "Massing" },
  { id: "model", label: "3D Model" }
];

const analyzeItems: { id: AnalyzeSubview; label: string }[] = [
  { id: "analysis", label: "Analysis" },
  { id: "systems", label: "MEP Systems" }
];

const deliverItems: { id: DeliverSubview; label: string }[] = [
  { id: "sheets", label: "Sheets" },
  { id: "render", label: "Render" },
  { id: "export", label: "Export" }
];

export function PhaseSubNav({ phase, activeTab, onTabChange }: PhaseSubNavProps) {
  const items =
    phase === "scheme" ? schemeItems : phase === "analyze" ? analyzeItems : phase === "deliver" ? deliverItems : [];

  if (items.length === 0) {
    return null;
  }

  const activeSubview =
    phase === "scheme"
      ? schemeSubviewForTab(activeTab) ?? "plan"
      : phase === "analyze"
        ? analyzeSubviewForTab(activeTab) ?? "analysis"
        : deliverSubviewForTab(activeTab) ?? "sheets";

  return (
    <div className="flex items-center gap-1 border-b border-line bg-[#0a0f15] px-4 py-2">
      <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted">
        {workflowPhaseDefinitions.find((item) => item.id === phase)?.label}
      </span>
      {items.map((item) => (
        <button
          className={`h-8 rounded px-3 text-xs ${
            activeSubview === item.id
              ? "bg-accent/15 text-accent"
              : "text-muted hover:bg-white/[0.04] hover:text-slate-100"
          }`}
          key={item.id}
          type="button"
          onClick={() => {
            if (phase === "scheme") {
              onTabChange(tabForSchemeSubview(item.id as SchemeSubview));
              return;
            }

            if (phase === "analyze") {
              onTabChange(tabForAnalyzeSubview(item.id as AnalyzeSubview));
              return;
            }

            onTabChange(tabForDeliverSubview(item.id as DeliverSubview));
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
