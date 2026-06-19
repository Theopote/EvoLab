"use client";

import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  analyzeSubviewForTab,
  deliverSubviewForTab,
  schemeSubviewForTab,
  tabForAnalyzeSubview,
  tabForDeliverSubview,
  tabForSchemeSubview,
  workflowPhaseDefinitions,
  type AnalyzeSubview,
  type BriefSiteSubview,
  type DeliverSubview,
  type QuantifySubview,
  type SchemeSubview,
  type WorkflowPhase
} from "@/lib/workflow-phases";
import type { WorkspaceTab } from "@/lib/project-types";
import { useEvoProject } from "@/lib/project-store";

interface PhaseSubNavProps {
  phase: WorkflowPhase;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const briefSiteItems: { id: BriefSiteSubview; label: string }[] = [
  { id: "site", label: "Site" },
  { id: "program", label: "Program" },
  { id: "intake", label: "Import" }
];

const schemeItems: { id: SchemeSubview; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "massing", label: "Massing" },
  { id: "model", label: "3D Model" },
  { id: "structure", label: "Structure" },
  { id: "facade", label: "Facade" }
];

const analyzeItems: { id: AnalyzeSubview; label: string }[] = [
  { id: "analysis", label: "Analysis" },
  { id: "systems", label: "MEP Systems" }
];

const quantifyItems: { id: QuantifySubview; label: string }[] = [
  { id: "quantity", label: "Quantities" },
  { id: "schedules", label: "Schedules" },
  { id: "compliance", label: "Compliance" }
];

const deliverItems: { id: DeliverSubview; label: string }[] = [
  { id: "sheets", label: "Sheets" },
  { id: "render", label: "Render" },
  { id: "export", label: "Export" }
];

export function PhaseSubNav({ phase, activeTab, onTabChange }: PhaseSubNavProps) {
  const { briefSiteSubview, quantifySubview, setBriefSiteSubview, setQuantifySubview } = useEvoProject(
    useShallow((state) => ({
      briefSiteSubview: state.briefSiteSubview,
      quantifySubview: state.quantifySubview,
      setBriefSiteSubview: state.setBriefSiteSubview,
      setQuantifySubview: state.setQuantifySubview
    }))
  );

  if (phase === "review") {
    return null;
  }

  if (phase === "brief_site") {
    return (
      <SubNavShell phase={phase}>
        {briefSiteItems.map((item) => (
          <SubNavButton
            active={briefSiteSubview === item.id}
            key={item.id}
            label={item.label}
            onClick={() => setBriefSiteSubview(item.id)}
          />
        ))}
      </SubNavShell>
    );
  }

  if (phase === "quantify") {
    return (
      <SubNavShell phase={phase}>
        {quantifyItems.map((item) => (
          <SubNavButton
            active={quantifySubview === item.id}
            key={item.id}
            label={item.label}
            onClick={() => setQuantifySubview(item.id)}
          />
        ))}
      </SubNavShell>
    );
  }

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
    <SubNavShell phase={phase}>
      {items.map((item) => (
        <SubNavButton
          active={activeSubview === item.id}
          key={item.id}
          label={item.label}
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
        />
      ))}
    </SubNavShell>
  );
}

function SubNavShell({ phase, children }: { phase: WorkflowPhase; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-b border-line bg-[#0a0f15] px-4 py-2">
      <span className="mr-2 text-[11px] uppercase tracking-[0.14em] text-muted">
        {workflowPhaseDefinitions.find((item) => item.id === phase)?.label}
      </span>
      {children}
    </div>
  );
}

function SubNavButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`h-8 rounded px-3 text-xs ${
        active ? "bg-accent/15 text-accent" : "text-muted hover:bg-white/[0.04] hover:text-slate-100"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
