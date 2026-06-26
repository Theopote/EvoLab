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
  topNavPhaseDefinitions,
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
  { id: "bubble", label: "气泡图" },
  { id: "plan", label: "平面" },
  { id: "compare", label: "对比" },
  { id: "massing", label: "体块" },
  { id: "facade", label: "立面" },
  { id: "structure", label: "结构" }
];

const analyzeItems: { id: AnalyzeSubview | QuantifySubview; label: string; quantify?: boolean }[] = [
  { id: "analysis", label: "分析图层" },
  { id: "systems", label: "机电系统" },
  { id: "quantity", label: "工程量", quantify: true },
  { id: "review", label: "变更审阅", quantify: true }
];

const deliverItems: { id: DeliverSubview; label: string }[] = [
  { id: "presentation", label: "汇报" },
  { id: "render", label: "效果图" },
  { id: "export", label: "导出" }
];

export function PhaseSubNav({ phase, activeTab, onTabChange }: PhaseSubNavProps) {
  const displayPhase = phase === "quantify" ? "analyze" : phase;

  const items =
    displayPhase === "scheme"
      ? schemeItems
      : displayPhase === "analyze"
        ? analyzeItems
        : displayPhase === "deliver"
          ? deliverItems
          : [];

  if (items.length === 0) {
    return null;
  }

  const activeSubview =
    displayPhase === "scheme"
      ? schemeSubviewForTab(activeTab) ?? "plan"
      : displayPhase === "analyze"
        ? analyzeSubviewForTab(activeTab) ?? quantifySubviewForTab(activeTab) ?? "analysis"
        : deliverSubviewForTab(activeTab) ?? "presentation";

  const phaseLabel = topNavPhaseDefinitions.find((item) => item.id === displayPhase)?.label;

  return (
    <div className="flex items-center gap-1 border-b border-line bg-[#0a0f15] px-4 py-2">
      <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted">{phaseLabel}</span>
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
            if (displayPhase === "scheme") {
              onTabChange(tabForSchemeSubview(item.id as SchemeSubview));
              return;
            }

            if (displayPhase === "analyze") {
              if ("quantify" in item && item.quantify) {
                onTabChange(tabForQuantifySubview(item.id as QuantifySubview));
                return;
              }

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
