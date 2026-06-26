"use client";

import Link from "next/link";
import { getToolDefinition } from "@/lib/tools/tool-definitions";
import { formatToolSessionStatus } from "@/lib/tools/tool-session-status";
import type { ToolSessionSummary } from "@/lib/tools/tool-session-types";

interface RecentToolSessionsListProps {
  sessions: ToolSessionSummary[];
  variant?: "stacked" | "inline";
  emptyMessage?: string;
}

export function RecentToolSessionsList({
  sessions,
  variant = "stacked",
  emptyMessage = "在工具箱中保存结果后，可从这里快速恢复。"
}: RecentToolSessionsListProps) {
  if (sessions.length === 0) {
    return (
      <p className="rounded border border-dashed border-line px-4 py-6 text-sm text-muted">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const tool = getToolDefinition(session.toolId);
        const statusLabel = formatToolSessionStatus(session.status);

        return (
          <Link
            className={`rounded border border-line bg-panel/70 px-4 py-3 transition hover:border-accent/40 ${
              variant === "inline" ? "block" : "flex items-center justify-between"
            }`}
            href={`/tools/${session.toolId}?session=${session.id}`}
            key={session.id}
          >
            {variant === "inline" ? (
              <div className="text-sm">
                <span className="text-slate-100">{session.title}</span>
                <span className="text-muted"> · </span>
                <span className="text-muted">{tool?.nameZh ?? session.toolId}</span>
                <span className="text-muted"> · </span>
                <span className="text-accent">{statusLabel}</span>
              </div>
            ) : (
              <>
                <div>
                  <div className="text-sm text-slate-100">{session.title}</div>
                  <div className="mt-1 text-xs text-muted">{tool?.nameZh ?? session.toolId}</div>
                </div>
                <span className="text-[11px] text-muted">{statusLabel}</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
