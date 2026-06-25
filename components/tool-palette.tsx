"use client";

import { Boxes, DraftingCompass, MousePointer2, Upload, Waypoints } from "lucide-react";
import type { ActiveTool } from "@/lib/interaction-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import type { WorkspaceTab } from "@/lib/project-types";

interface ToolPaletteProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  onImportTab?: () => void;
}

const tools: {
  label: string;
  title: string;
  icon: typeof MousePointer2;
  tool: ActiveTool;
  targetTab?: WorkspaceTab;
  opensImport?: boolean;
}[] = [
  { label: "Select", title: "Select", icon: MousePointer2, tool: "select" },
  { label: "Outline", title: "Draw outline", icon: DraftingCompass, tool: "outline", targetTab: "Plan" },
  { label: "Upload", title: "Upload drawing", icon: Upload, tool: "upload", targetTab: "Import", opensImport: true },
  { label: "Flow", title: "Analysis flows", icon: Waypoints, tool: "flow", targetTab: "Analysis" },
  { label: "Model", title: "3D model", icon: Boxes, tool: "model", targetTab: "Massing" }
];

export function ToolPalette({ activeTab, onTabChange, onImportTab }: ToolPaletteProps) {
  const activeTool = useInteractionStore((state) => state.activeTool);
  const setActiveTool = useInteractionStore((state) => state.setActiveTool);
  const requestUploadPicker = useCopilotUploadStore((state) => state.requestUploadPicker);

  return (
    <aside className="border-b border-line pb-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted">Tools</div>
      <div className="grid grid-cols-5 gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.tool || (tool.targetTab ? activeTab === tool.targetTab : false);

          return (
            <button
              className={`grid h-10 place-items-center rounded border ${
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

                if (tool.opensImport) {
                  onImportTab?.();
                  onTabChange(tool.targetTab ?? "Import");
                  requestUploadPicker();
                  return;
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
