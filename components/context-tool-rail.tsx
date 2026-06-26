"use client";

import {
  Boxes,
  DraftingCompass,
  MousePointer2,
  Pencil,
  Sparkles,
  Spline,
  SquarePlus,
  Upload,
  Wand2,
  Waypoints
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActiveTool } from "@/lib/interaction-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import type { WorkspaceTab } from "@/lib/project-types";
import type { WorkflowPhase } from "@/lib/workflow-phases";

interface ContextToolRailProps {
  phase: WorkflowPhase;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onImportTab?: () => void;
}

interface ContextToolDefinition {
  label: string;
  title: string;
  icon: LucideIcon;
  tool: ActiveTool;
  phases: WorkflowPhase[];
  targetTab?: WorkspaceTab;
  opensImport?: boolean;
}

const contextTools: ContextToolDefinition[] = [
  {
    label: "选择",
    title: "选择对象",
    icon: MousePointer2,
    tool: "select",
    phases: ["import", "site", "program", "scheme", "analyze", "quantify", "deliver"]
  },
  {
    label: "轮廓",
    title: "绘制用地轮廓",
    icon: DraftingCompass,
    tool: "outline",
    phases: ["import", "site", "program", "scheme"],
    targetTab: "Plan"
  },
  {
    label: "追踪",
    title: "追踪房间顶点",
    icon: Wand2,
    tool: "trace",
    phases: ["scheme"]
  },
  {
    label: "修复",
    title: "AI 局部修复",
    icon: Sparkles,
    tool: "inpaint",
    phases: ["scheme"]
  },
  {
    label: "手绘",
    title: "平板手绘输入",
    icon: Pencil,
    tool: "sketch_input",
    phases: ["scheme"]
  },
  {
    label: "改形",
    title: "沿墙段改轮廓",
    icon: Spline,
    tool: "reshape_boundary",
    phases: ["scheme"]
  },
  {
    label: "凸出",
    title: "添加飘窗或凸出",
    icon: SquarePlus,
    tool: "add_protrusion",
    phases: ["scheme"]
  },
  {
    label: "上传",
    title: "上传图纸",
    icon: Upload,
    tool: "upload",
    phases: ["import", "site", "program", "scheme"],
    targetTab: "Import",
    opensImport: true
  },
  {
    label: "分析",
    title: "分析图层",
    icon: Waypoints,
    tool: "flow",
    phases: ["analyze", "quantify"],
    targetTab: "Analysis"
  },
  {
    label: "体块",
    title: "3D 体块",
    icon: Boxes,
    tool: "model",
    phases: ["scheme"],
    targetTab: "Massing"
  }
];

export function ContextToolRail({ phase, activeTab, onTabChange, onImportTab }: ContextToolRailProps) {
  const activeTool = useInteractionStore((state) => state.activeTool);
  const setActiveTool = useInteractionStore((state) => state.setActiveTool);
  const requestUploadPicker = useCopilotUploadStore((state) => state.requestUploadPicker);
  const visibleTools = contextTools.filter((tool) => tool.phases.includes(phase));

  if (visibleTools.length === 0) {
    return null;
  }

  return (
    <aside className="border-b border-line pb-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted">工具</div>
      <div className="grid grid-cols-5 gap-2">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          const isActive =
            activeTool === tool.tool || (tool.targetTab !== undefined && activeTab === tool.targetTab);

          return (
            <button
              className={`grid h-10 place-items-center rounded border ${
                isActive
                  ? "border-accent/60 bg-accent/12 text-accent"
                  : "border-line text-muted hover:border-accent/50 hover:text-accent"
              }`}
              key={tool.tool}
              type="button"
              title={tool.title}
              aria-label={tool.label}
              onClick={() => {
                setActiveTool(tool.tool);

                if (tool.opensImport) {
                  onImportTab?.();
                  onTabChange(tool.targetTab ?? "Import");
                  requestUploadPicker();
                  return;
                }

                if (tool.tool === "upload") {
                  requestUploadPicker();
                }

                if (tool.targetTab) {
                  onTabChange(tool.targetTab);
                }
              }}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
