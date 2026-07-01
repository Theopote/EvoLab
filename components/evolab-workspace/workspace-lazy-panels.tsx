"use client";

import dynamic from "next/dynamic";
import { WorkspacePanelFallback } from "@/components/evolab-workspace/workspace-panel-fallback";

function panelLoading(label: string) {
  return function PanelLoading() {
    return <WorkspacePanelFallback label={label} />;
  };
}

export const LazyBubbleDiagramCanvas = dynamic(
  () => import("@/components/workflow/BubbleDiagramCanvas").then((m) => ({ default: m.BubbleDiagramCanvas })),
  { loading: panelLoading("加载气泡图…") }
);

export const LazyCompareWorkspace = dynamic(
  () => import("@/components/workflow/CompareWorkspace").then((m) => ({ default: m.CompareWorkspace })),
  { loading: panelLoading("加载对比视图…") }
);

export const LazyReviewWorkspace = dynamic(
  () => import("@/components/workflow/ReviewWorkspace").then((m) => ({ default: m.ReviewWorkspace })),
  { loading: panelLoading("加载审阅面板…") }
);

export const LazyIntakeWorkspace = dynamic(
  () => import("@/components/workflow/IntakeWorkspace").then((m) => ({ default: m.IntakeWorkspace })),
  { loading: panelLoading("加载导入向导…") }
);

export const LazyProgramWorkspace = dynamic(
  () => import("@/components/workflow/ProgramWorkspace").then((m) => ({ default: m.ProgramWorkspace })),
  { loading: panelLoading("加载任务书…") }
);

export const LazySiteWorkspace = dynamic(
  () => import("@/components/workflow/SiteWorkspace").then((m) => ({ default: m.SiteWorkspace })),
  { loading: panelLoading("加载场地编辑…") }
);

export const LazyStructureWorkspace = dynamic(
  () => import("@/components/workflow/StructureWorkspace").then((m) => ({ default: m.StructureWorkspace })),
  { loading: panelLoading("加载结构面板…") }
);

export const LazyFacadeWorkspace = dynamic(
  () => import("@/components/workflow/FacadeWorkspace").then((m) => ({ default: m.FacadeWorkspace })),
  { loading: panelLoading("加载立面面板…") }
);

export const LazyFurnitureWorkspace = dynamic(
  () => import("@/components/workflow/FurnitureWorkspace").then((m) => ({ default: m.FurnitureWorkspace })),
  { loading: panelLoading("加载家具布置…") }
);

export const LazyMassingPanel = dynamic(
  () => import("@/components/massing-panel").then((m) => ({ default: m.MassingPanel })),
  { loading: panelLoading("加载体量面板…") }
);

export const LazyDeliverPresentationView = dynamic(
  () => import("@/components/presentation/DeliverPresentationView").then((m) => ({ default: m.DeliverPresentationView })),
  { loading: panelLoading("加载演示输出…") }
);

export const LazyExportPanel = dynamic(
  () => import("@/components/export-panel").then((m) => ({ default: m.ExportPanel })),
  { loading: panelLoading("加载导出面板…") }
);

export const LazySchemeSplitViewport = dynamic(
  () => import("@/components/workflow/SchemeSplitViewport").then((m) => ({ default: m.SchemeSplitViewport })),
  { loading: panelLoading("加载方案视图…") }
);

export const LazyPlanResultGrid = dynamic(
  () => import("@/components/plan-editor/PlanResultGrid").then((m) => ({ default: m.PlanResultGrid })),
  { loading: panelLoading("加载方案结果…") }
);

export const LazyDiagramLayerList = dynamic(
  () => import("@/components/diagrams/DiagramLayerList").then((m) => ({ default: m.DiagramLayerList })),
  { loading: panelLoading("加载分析图层…") }
);

export const LazyDiagramCanvas = dynamic(
  () => import("@/components/diagrams/DiagramCanvas").then((m) => ({ default: m.DiagramCanvas })),
  { loading: panelLoading("加载分析画布…") }
);

export const LazyMepLayerList = dynamic(
  () => import("@/components/mep/MepLayerList").then((m) => ({ default: m.MepLayerList })),
  { loading: panelLoading("加载机电图层…") }
);

export const LazyMepCanvas = dynamic(
  () => import("@/components/mep/MepCanvas").then((m) => ({ default: m.MepCanvas })),
  { loading: panelLoading("加载机电画布…") }
);

export const LazyQuantityTable = dynamic(
  () => import("@/components/quantity/QuantityTable").then((m) => ({ default: m.QuantityTable })),
  { loading: panelLoading("加载工程量表…") }
);

export const LazyExplodeSlider = dynamic(
  () => import("@/components/viewer-3d/ExplodeSlider").then((m) => ({ default: m.ExplodeSlider })),
  { loading: panelLoading("加载爆炸视图…") }
);
