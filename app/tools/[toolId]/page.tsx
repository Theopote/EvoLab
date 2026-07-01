"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ToolPagePlaceholder } from "@/components/tools/ToolPagePlaceholder";
import { EvoProjectProvider } from "@/lib/project-store";
import { getToolDefinition } from "@/lib/tools/tool-definitions";

const TraceToCadTool = dynamic(
  () => import("@/components/tools/TraceToCadTool").then((m) => ({ default: m.TraceToCadTool })),
  { loading: () => <ToolLoadingFallback /> }
);

const RetainedStructureRemixTool = dynamic(
  () => import("@/components/tools/RetainedStructureRemixTool").then((m) => ({ default: m.RetainedStructureRemixTool })),
  { loading: () => <ToolLoadingFallback /> }
);

const PresentationGeneratorTool = dynamic(
  () => import("@/components/tools/PresentationGeneratorTool").then((m) => ({ default: m.PresentationGeneratorTool })),
  { loading: () => <ToolLoadingFallback /> }
);

function ToolLoadingFallback() {
  return <div className="grid min-h-screen place-items-center bg-canvas text-muted">加载工具…</div>;
}

interface ToolDetailPageProps {
  params: { toolId: string };
}

export default function ToolDetailPage({ params }: ToolDetailPageProps) {
  const tool = getToolDefinition(params.toolId);

  if (!tool) {
    notFound();
  }

  if (tool.status !== "available") {
    return <ToolPagePlaceholder tool={tool} />;
  }

  const content =
    params.toolId === "trace-to-cad" ? (
      <Suspense fallback={<ToolLoadingFallback />}>
        <TraceToCadTool />
      </Suspense>
    ) : params.toolId === "retained-structure-remix" ? (
      <Suspense fallback={<ToolLoadingFallback />}>
        <RetainedStructureRemixTool />
      </Suspense>
    ) : params.toolId === "presentation-generator" ? (
      <Suspense fallback={<ToolLoadingFallback />}>
        <PresentationGeneratorTool />
      </Suspense>
    ) : (
      <ToolPagePlaceholder tool={tool} />
    );

  return <EvoProjectProvider>{content}</EvoProjectProvider>;
}
