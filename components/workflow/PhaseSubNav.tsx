"use client";

import {
  analyzeSubviewForTab,
  deliverSubviewForTab,
  quantifySubviewForTab,
  schemeSubviewForTab,
  tabForAnalyzeSubview,
  tabForDeliverSubview,
  tabForQuantifySubview,
  tabForSchemeSubview,
  workflowPhaseDefinitions,
  type AnalyzeSubview,
  type DeliverSubview,
  type QuantifySubview,
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
  { id: "bubble", label: "Bubble" },
  { id: "plan", label: "Plan" },
  { id: "compare", label: "Compare" },
  { id: "massing", label: "Massing" },
  { id: "facade", label: "Facade" },
  { id: "structure", label: "Structure" }
];

const analyzeItems: { id: AnalyzeSubview; label: string }[] = [
  { id: "analysis", label: "Analysis" },
  { id: "systems", label: "MEP Systems" }
];

const quantifyItems: { id: QuantifySubview; label: string }[] = [
  { id: "quantity", label: "Quantity" },
  { id: "review", label: "Review" }
];

const deliverItems: { id: DeliverSubview; label: string }[] = [
  { id: "presentation", label: "Presentation" },
  { id: "render", label: "Render" },
  { id: "export", label: "Export" }
];

export function PhaseSubNav({ phase, activeTab, onTabChange }: PhaseSubNavProps) {
  const items =
    phase === "scheme"
      ? schemeItems
      : phase === "analyze"
        ? analyzeItems
        : phase === "quantify"
          ? quantifyItems
          : phase === "deliver"
            ? deliverItems
            : [];

  if (items.length === 0) {
    return null;
  }

  const activeSubview =
    phase === "scheme"
      ? schemeSubviewForTab(activeTab) ?? "plan"
      : phase === "analyze"
        ? analyzeSubviewForTab(activeTab) ?? "analysis"
        : phase === "quantify"
          ? quantifySubviewForTab(activeTab) ?? "quantity"
          : deliverSubviewForTab(activeTab) ?? "presentation";

  return (
    <div className="flex items-center gap-1 border-b border-line bg-[#0a0f15] px-4 py-2">
      <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted">
        {workflowPhaseDefinitions.find((item) => item.id === phase)?.label}
      </span>
      {items.map((item) => (
        <button
          className={`h-8 rounded px-3 text-xs ${
            activeSubview === item.id || (item.id === "massing" && activeSubview === "model")
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

            if (phase === "quantify") {
              onTabChange(tabForQuantifySubview(item.id as QuantifySubview));
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
