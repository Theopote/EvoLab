"use client";

import { Boxes, DraftingCompass, MousePointer2, Upload, Waypoints } from "lucide-react";
import type { ActiveTool } from "@/lib/interaction-store";
import { useInteractionStore } from "@/lib/interaction-store";
import type { WorkspaceTab } from "@/lib/project-types";

interface ToolPaletteProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const tools: {
  label: string;
  title: string;
  icon: typeof MousePointer2;
  tool: ActiveTool;
  targetTab?: WorkspaceTab;
}[] = [
  { label: "Select", title: "Select", icon: MousePointer2, tool: "select" },
  { label: "Outline", title: "Draw outline", icon: DraftingCompass, tool: "outline", targetTab: "Plan" },
  { label: "Upload", title: "Upload drawing", icon: Upload, tool: "upload" },
  { label: "Flow", title: "Analysis flows", icon: Waypoints, tool: "flow", targetTab: "Analysis" },
  { label: "Model", title: "3D model", icon: Boxes, tool: "model", targetTab: "Model" }
];

export function ToolPalette({ activeTab, onTabChange }: ToolPaletteProps) {
  const activeTool = useInteractionStore((state) => state.activeTool);
  const setActiveTool = useInteractionStore((state) => state.setActiveTool);

  return (
    <aside className="border-r border-line bg-[#0a0f15] p-3">
      <div className="flex h-full flex-col items-center gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.tool || (tool.targetTab ? activeTab === tool.targetTab : false);

          return (
            <button
              className={`grid h-11 w-11 place-items-center rounded border ${
                isActive
                  ? "border-accent/60 bg-accent/12 text-accent"
                  : "border-line text-muted hover:border-accent/50 hover:text-accent"
              }`}
              key={tool.label}
              type="button"
              title={tool.title}
              aria-label={tool.label}
              onClick={() => {
                setActiveTool(tool.tool);
                if (tool.targetTab) {
                  onTabChange(tool.targetTab);
                }
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="sr-only">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
