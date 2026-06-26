"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  getToolDefinition,
  toolCategoryLabels,
  toolDefinitions,
  type ToolCategory
} from "@/lib/tools/tool-definitions";
import { useToolSessionStore } from "@/lib/tools/tool-session-store";
import type { ToolSessionStatus } from "@/lib/tools/tool-session-types";

function sessionStatusLabel(status: ToolSessionStatus) {
  switch (status) {
    case "ready":
      return "可继续";
    case "promoted":
      return "已加入项目";
    default:
      return "草稿";
  }
}

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
  const listRecentSessions = useToolSessionStore((state) => state.listRecentSessions);
  const [recentSessions, setRecentSessions] = useState(() => listRecentSessions(4));

  useEffect(() => {
    setRecentSessions(listRecentSessions(4));
  }, [listRecentSessions]);

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
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-semibold text-white">继续上次工具任务</h2>
          {recentSessions.length > 0 ? (
            <div className="space-y-2">
              {recentSessions.map((session) => {
                const tool = getToolDefinition(session.toolId);

                return (
                  <Link
                    className="block rounded border border-line bg-panel/70 px-4 py-3 transition hover:border-accent/40"
                    href={`/tools/${session.toolId}?session=${session.id}`}
                    key={session.id}
                  >
                    <div className="text-sm">
                      <span className="text-slate-100">{session.title}</span>
                      <span className="text-muted"> · </span>
                      <span className="text-muted">{tool?.nameZh ?? session.toolId}</span>
                      <span className="text-muted"> · </span>
                      <span className="text-accent">{sessionStatusLabel(session.status)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="rounded border border-dashed border-line px-4 py-6 text-sm text-muted">
              在工具中保存结果后，可从这里快速恢复上次任务。
            </p>
          )}
        </section>

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
