"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export interface ToolPageShellProps {
  toolName: string;
  toolDescription: string;
  inputPanel: ReactNode;
  previewPanel: ReactNode;
  resultPanel: ReactNode;
  footerActions: ReactNode;
}

export function ToolPageShell({
  toolName,
  toolDescription,
  inputPanel,
  previewPanel,
  resultPanel,
  footerActions
}: ToolPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-[#0b1118] px-4">
        <Link
          className="rounded border border-line p-1.5 text-muted transition hover:border-accent/50 hover:text-accent"
          href="/tools"
          aria-label="返回工具箱"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white">{toolName}</h1>
          <p className="truncate text-[11px] text-muted">{toolDescription}</p>
        </div>
        <Link
          className="ml-auto shrink-0 rounded border border-line px-3 py-1 text-xs text-muted transition hover:border-accent/50 hover:text-accent"
          href="/workspace"
        >
          工作台
        </Link>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(240px,320px)_minmax(0,1fr)_minmax(220px,280px)] overflow-hidden">
        <section className="flex min-h-0 flex-col overflow-auto border-r border-line bg-[#0a0f15] p-4">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">输入</h2>
          {inputPanel}
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden bg-[#0c1117]">
          <div className="border-b border-line px-4 py-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">预览</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{previewPanel}</div>
        </section>

        <section className="flex min-h-0 flex-col overflow-auto border-l border-line bg-[#0d141d] p-4">
          <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">参数 / 结果</h2>
          {resultPanel}
        </section>
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-[#0a0f15] px-4 py-3">
        {footerActions}
      </footer>
    </div>
  );
}
