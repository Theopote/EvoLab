import type { ToolSession, ToolSessionMap } from "@/lib/tools/tool-session-types";

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
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeToolSessions(sessions: ToolSessionMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function createToolSessionId() {
  return `tool-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
