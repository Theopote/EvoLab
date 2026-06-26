"use client";

import { notFound } from "next/navigation";
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

  const content = params.toolId === "trace-to-cad" ? <TraceToCadTool /> : <ToolPagePlaceholder tool={tool} />;

  return <EvoProjectProvider>{content}</EvoProjectProvider>;
}
