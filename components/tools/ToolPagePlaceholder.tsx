"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ToolDefinition } from "@/lib/tools/tool-definitions";

interface ToolPagePlaceholderProps {
  tool: ToolDefinition;
}

export function ToolPagePlaceholder({ tool }: ToolPagePlaceholderProps) {
  const Icon = tool.icon;

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <header className="flex h-12 items-center gap-3 border-b border-line bg-[#0b1118] px-4">
        <Link
          className="rounded border border-line p-1.5 text-muted transition hover:border-accent/50 hover:text-accent"
          href="/tools"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-sm font-semibold text-white">{tool.nameZh}</h1>
      </header>
      <div className="grid flex-1 place-items-center p-8 text-center">
        <Icon className="h-10 w-10 text-accent" />
        <p className="mt-4 text-lg font-medium text-white">{tool.nameZh}</p>
        <p className="mt-2 max-w-md text-sm text-muted">{tool.descriptionZh}</p>
        <span className="mt-4 rounded border border-line px-3 py-1 text-xs text-muted">即将推出</span>
      </div>
    </main>
  );
}
