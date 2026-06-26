import type { ToolSessionMap } from "@/lib/tools/tool-session-types";
import { hydrateStoredRecord, toStoredMap, toStoredSession } from "@/lib/tools/tool-session-persist";

const STORAGE_KEY = "evolab.tool.sessions";

function storedPayloadNeedsMigration(parsed: Record<string, unknown>): boolean {
  const text = JSON.stringify(parsed);
  return /data:image|data:application|"dataUrl"|"deck"|"briefs"/.test(text);
}

export function readToolSessions(): ToolSessionMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const hydrated = Object.fromEntries(
      Object.entries(parsed).map(([id, record]) => [id, hydrateStoredRecord(record)])
    );

    if (storedPayloadNeedsMigration(parsed)) {
      writeToolSessions(hydrated);
    }

    return hydrated;
  } catch {
    return {};
  }
}

export function writeToolSessions(sessions: ToolSessionMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredMap(sessions)));
}

export function createToolSessionId() {
  return `tool-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export { toStoredMap, toStoredSession };
