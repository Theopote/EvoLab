import type { ToolSession, ToolSessionMap } from "@/lib/tools/tool-session-types";
import { normalizeToolSession } from "@/lib/tools/tool-session-utils";

const STORAGE_KEY = "evolab.tool.sessions";

export function readToolSessions(): ToolSessionMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as ToolSessionMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([id, session]) => [id, normalizeToolSession(session)])
    );
  } catch {
    return {};
  }
}

export function writeToolSessions(sessions: ToolSessionMap) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = Object.fromEntries(
    Object.entries(sessions).map(([id, session]) => [id, normalizeToolSession(session)])
  );

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function createToolSessionId() {
  return `tool-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
