"use client";

import { Boxes, DraftingCompass, MousePointer2, Pencil, Sparkles, Spline, SquarePlus, Upload, Wand2, Waypoints } from "lucide-react";
import type { ActiveTool } from "@/lib/interaction-store";
import { useInteractionStore } from "@/lib/interaction-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import { SimpleTooltip } from "@/components/ui/Tooltip";

const tools: {
  label: string;
  title: string;
  description: string;
  icon: typeof MousePointer2;
  tool: ActiveTool;
  phases: WorkflowPhase[];
}[] = [
  {
    label: "选择",
    title: "选择工具",
    description: "选择和编辑房间、墙体或其他元素",
    icon: MousePointer2,
    tool: "select",
    phases: ["import", "site", "program", "scheme", "analyze"]
  },
  {
    label: "轮廓",
    title: "绘制轮廓",
    description: "手动绘制建筑轮廓或房间边界",
    icon: DraftingCompass,
    tool: "outline",
    phases: ["import", "site", "program", "scheme"]
  },
  {
    label: "描边",
    title: "描边工具",
    description: "沿着导入的图纸描绘房间顶点",
    icon: Wand2,
    tool: "trace",
    phases: ["scheme"]
  },
  {
    label: "AI修补",
    title: "AI修补画笔",
    description: "使用AI智能填充或修改平面布局",
    icon: Sparkles,
    tool: "inpaint",
    phases: ["scheme"]
  },
  {
    label: "草图",
    title: "手绘草图",
    description: "使用触控笔或鼠标手绘房间布局",
    icon: Pencil,
    tool: "sketch_input",
    phases: ["scheme"]
  },
  {
    label: "重塑",
    title: "边界重塑",
    description: "沿墙体跨度调整房间边界形状",
    icon: Spline,
    tool: "reshape_boundary",
    phases: ["scheme"]
  },
  {
    label: "凸出",
    title: "添加凸窗",
    description: "在墙体上添加飘窗或凸出部分",
    icon: SquarePlus,
    tool: "add_protrusion",
    phases: ["scheme"]
  },
  {
    label: "上传",
    title: "上传图纸",
    description: "上传CAD图纸、PDF或图片作为参考底图",
    icon: Upload,
    tool: "upload",
    phases: ["import", "site", "program", "scheme"]
  },
  {
    label: "流线",
    title: "分析流线",
    description: "显示和分析交通流线与功能分区",
    icon: Waypoints,
    tool: "flow",
    phases: ["analyze"]
  },
  {
    label: "模型",
    title: "3D模型",
    description: "切换到完整的3D建筑模型视图",
    icon: Boxes,
    tool: "model",
    phases: ["scheme"]
  }
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
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">快捷工具</h2>
      <div className="grid grid-cols-4 gap-2 md:grid-cols-5 lg:grid-cols-4">
        {visibleTools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.tool;

          return (
            <SimpleTooltip
              key={tool.label}
              title={
                <div className="max-w-xs">
                  <div className="font-semibold">{tool.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-300">{tool.description}</div>
                </div>
              }
              side="bottom"
            >
              <button
                className={`grid h-10 place-items-center rounded border transition-colors ${
                  isActive
                    ? "border-accent/60 bg-accent/12 text-accent"
                    : "border-line text-muted hover:border-accent/50 hover:bg-panel/30 hover:text-accent"
                }`}
                type="button"
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
            </SimpleTooltip>
          );
        })}
      </div>
    </div>
  );
}
