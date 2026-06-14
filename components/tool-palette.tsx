"use client";

import { Boxes, DraftingCompass, MousePointer2, Upload, Waypoints } from "lucide-react";
import type { WorkspaceTab } from "@/components/top-nav";

interface ToolPaletteProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const tools: {
  label: string;
  title: string;
  icon: typeof MousePointer2;
  targetTab?: WorkspaceTab;
}[] = [
  { label: "选择", title: "选择", icon: MousePointer2 },
  { label: "轮廓", title: "轮廓", icon: DraftingCompass, targetTab: "Plan" },
  { label: "上传", title: "上传", icon: Upload },
  { label: "流线", title: "流线", icon: Waypoints, targetTab: "Analysis" },
  { label: "模型", title: "模型", icon: Boxes, targetTab: "Model" }
];

export function ToolPalette({ activeTab, onTabChange }: ToolPaletteProps) {
  return (
    <aside className="border-r border-line bg-[#0a0f15] p-3">
      <div className="flex h-full flex-col items-center gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = tool.targetTab ? activeTab === tool.targetTab : false;

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
