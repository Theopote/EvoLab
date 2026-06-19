"use client";

import { Boxes, DraftingCompass, MousePointer2, Pencil, Sparkles, Spline, SquarePlus, Upload, Wand2, Waypoints } from "lucide-react";
import type { ActiveTool } from "@/lib/interaction-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import type { WorkflowPhase } from "@/lib/workflow-phases";

const tools: {
  label: string;
  title: string;
  icon: typeof MousePointer2;
  tool: ActiveTool;
  phases: WorkflowPhase[];
}[] = [
  { label: "Select", title: "Select", icon: MousePointer2, tool: "select", phases: ["brief_site", "scheme", "analyze"] },
  { label: "Outline", title: "Draw outline", icon: DraftingCompass, tool: "outline", phases: ["brief_site", "scheme"] },
  { label: "Trace", title: "Trace room vertices", icon: Wand2, tool: "trace", phases: ["brief_site", "scheme"] },
  { label: "Inpaint", title: "AI inpaint brush", icon: Sparkles, tool: "inpaint", phases: ["scheme"] },
  { label: "Sketch", title: "Tablet sketch room input", icon: Pencil, tool: "sketch_input", phases: ["scheme"] },
  { label: "Reshape", title: "Boundary reshape along wall span", icon: Spline, tool: "reshape_boundary", phases: ["scheme"] },
  { label: "Protrude", title: "Add bay window or bump-out", icon: SquarePlus, tool: "add_protrusion", phases: ["scheme"] },
  { label: "Upload", title: "Upload drawing", icon: Upload, tool: "upload", phases: ["brief_site", "scheme"] },
  { label: "Flow", title: "Analysis flows", icon: Waypoints, tool: "flow", phases: ["analyze"] },
  { label: "Model", title: "3D model", icon: Boxes, tool: "model", phases: ["scheme"] }
];

interface WorkflowQuickToolsProps {
  phase: WorkflowPhase;
}

export function WorkflowQuickTools({ phase }: WorkflowQuickToolsProps) {
  const activeTool = useInteractionStore((state) => state.activeTool);
  const setActiveTool = useInteractionStore((state) => state.setActiveTool);
  const requestUploadPicker = useCopilotUploadStore((state) => state.requestUploadPicker);
  const visibleTools = tools.filter((tool) => tool.phases.includes(phase));

  if (visibleTools.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Quick Tools</h2>
      <div className="grid grid-cols-4 gap-2">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.tool;

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

                if (tool.tool === "upload") {
                  requestUploadPicker();
                }
              }}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
