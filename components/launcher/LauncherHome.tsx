"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Clock3, Sparkles, Wrench } from "lucide-react";
import { RecentToolSessionsList } from "@/components/tools/RecentToolSessionsList";
import { workflowTemplates } from "@/lib/launcher/workflow-templates";
import { listRecentProjects, type ProjectRegistryEntry } from "@/lib/project-registry";
import { selectRecentToolSessions, useToolSessionStore } from "@/lib/tools/tool-session-store";

const entryCards = [
  {
    href: "/workspace",
    title: "项目工作台",
    description: "场地、任务书、方案、分析、交付 — 完整设计流程与版本管理。",
    icon: Boxes,
    accent: "border-accent/40 bg-accent/10 text-accent"
  },
  {
    href: "/tools",
    title: "AI 工具箱",
    description: "扫描转 CAD、地图体块、多版平面等独立 AI 工具，快速完成单项任务。",
    icon: Wrench,
    accent: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
  }
] as const;

export function LauncherHome() {
  const [recentProjects, setRecentProjects] = useState<ProjectRegistryEntry[]>([]);
  const recentSessions = useToolSessionStore(selectRecentToolSessions(4));

  useEffect(() => {
    setRecentProjects(listRecentProjects(5));
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <header className="border-b border-line bg-[#0b1118] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded border border-accent/40 bg-accent/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">EvoLab</h1>
            <p className="text-xs text-muted">建筑师方案设计阶段 AI 工作台</p>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-muted">Welcome</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">从哪里开始？</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            进入项目工作台继续完整流程，或打开 AI 工具箱完成扫描转 CAD 等单项任务。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {entryCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                className="group rounded border border-line bg-panel/80 p-6 transition hover:border-accent/40 hover:bg-panel"
                href={card.href}
                key={card.href}
              >
                <div className={`mb-4 inline-flex rounded border p-2.5 ${card.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{card.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm text-accent group-hover:gap-2">
                  进入
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-semibold text-white">最近项目</h3>
            </div>
            {recentProjects.length > 0 ? (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <Link
                    className="flex items-center justify-between rounded border border-line bg-panel/70 px-4 py-3 transition hover:border-accent/40"
                    href="/workspace"
                    key={project.projectId}
                  >
                    <div>
                      <div className="text-sm text-slate-100">{project.projectName}</div>
                      <div className="mt-1 text-xs text-muted">
                        {project.versionCount} 版本 · {project.projectType}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted">
                      {new Date(project.lastAccessedAt).toLocaleDateString("zh-CN")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded border border-dashed border-line px-4 py-6 text-sm text-muted">
                打开工作台后将在此显示最近访问的项目。
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-white">最近工具会话</h3>
            <RecentToolSessionsList sessions={recentSessions} />
          </section>
        </div>

        <section className="mt-10">
          <h3 className="mb-3 text-sm font-semibold text-white">示例工作流</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflowTemplates.map((template) => (
              <Link
                className="rounded border border-line bg-panel/70 p-4 transition hover:border-accent/40"
                href={template.href}
                key={template.id}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-white">{template.title}</h4>
                  {template.badge ? (
                    <span className="rounded border border-line px-2 py-0.5 text-[10px] text-muted">{template.badge}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">{template.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <footer className="border-t border-line px-6 py-4 text-center text-xs text-muted">
        EvoLab · 方案设计阶段 · Next.js 14
      </footer>
    </main>
  );
}
