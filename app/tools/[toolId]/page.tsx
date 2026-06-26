"use client";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { RetainedStructureRemixTool } from "@/components/tools/RetainedStructureRemixTool";
import { PresentationGeneratorTool } from "@/components/tools/PresentationGeneratorTool";
import { TraceToCadTool } from "@/components/tools/TraceToCadTool";
import { ToolPagePlaceholder } from "@/components/tools/ToolPagePlaceholder";
import { EvoProjectProvider } from "@/lib/project-store";
import { getToolDefinition } from "@/lib/tools/tool-definitions";

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
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-muted">加载工具…</div>}>
        <TraceToCadTool />
      </Suspense>
    ) : params.toolId === "retained-structure-remix" ? (
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-muted">加载工具…</div>}>
        <RetainedStructureRemixTool />
      </Suspense>
    ) : params.toolId === "presentation-generator" ? (
      <Suspense fallback={<div className="grid min-h-screen place-items-center bg-canvas text-muted">加载工具…</div>}>
        <PresentationGeneratorTool />
      </Suspense>
    ) : (
      <ToolPagePlaceholder tool={tool} />
    );

  return <EvoProjectProvider>{content}</EvoProjectProvider>;
}
