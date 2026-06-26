"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { toolCategoryLabels, toolDefinitions, type ToolCategory } from "@/lib/tools/tool-definitions";

const categoryOrder: ToolCategory[] = [
  "import",
  "site",
  "scheme",
  "interior",
  "presentation",
  "analysis",
  "structure",
  "mep"
];

export function ToolsHome() {
  const grouped = categoryOrder
    .map((category) => ({
      category,
      label: toolCategoryLabels[category],
      tools: toolDefinitions.filter((tool) => tool.category === category)
    }))
    .filter((group) => group.tools.length > 0);

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <header className="border-b border-line bg-[#0b1118] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link
            className="rounded border border-line p-2 text-muted transition hover:border-accent/50 hover:text-accent"
            href="/"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <div>
              <h1 className="text-sm font-semibold text-white">AI 工具箱</h1>
              <p className="text-[10px] text-muted">独立工具 · 可导出 · 可加入项目</p>
            </div>
          </div>
          <Link
            className="ml-auto rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/50 hover:text-accent"
            href="/workspace"
          >
            打开工作台
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {grouped.map((group) => (
          <section className="mb-10" key={group.category}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                const isAvailable = tool.status === "available";

                return (
                  <Link
                    className={`rounded border p-4 transition ${
                      isAvailable
                        ? "border-line bg-panel/80 hover:border-accent/40 hover:bg-panel"
                        : "border-line/60 bg-panel/40 opacity-80 hover:border-line"
                    }`}
                    href={isAvailable ? `/tools/${tool.id}` : "#"}
                    key={tool.id}
                    onClick={isAvailable ? undefined : (event) => event.preventDefault()}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Icon className="h-5 w-5 shrink-0 text-accent" />
                      {!isAvailable ? (
                        <span className="rounded border border-line px-2 py-0.5 text-[10px] text-muted">即将推出</span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">{tool.nameZh}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted">{tool.descriptionZh}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
