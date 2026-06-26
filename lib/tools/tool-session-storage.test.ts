import { beforeEach, describe, expect, it, vi } from "vitest";
import { readToolSessions, writeToolSessions } from "@/lib/tools/tool-session-storage";
import type { ToolSessionMap } from "@/lib/tools/tool-session-types";

const STORAGE_KEY = "evolab.tool.sessions";

function createSessionMap(): ToolSessionMap {
  return {
    "session-1": {
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      canPromoteToProject: true,
      status: "ready"
    }
  };
}

describe("tool session storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn()
      }
    });
  });

  it("returns empty map when storage is empty", () => {
    window.localStorage.getItem = vi.fn(() => null);

    expect(readToolSessions()).toEqual({});
  });

  it("reads persisted sessions from localStorage", () => {
    const sessions = createSessionMap();
    window.localStorage.getItem = vi.fn(() => JSON.stringify(sessions));

    expect(readToolSessions()).toEqual(sessions);
  });

  it("writes sessions to localStorage", () => {
    const sessions = createSessionMap();
    writeToolSessions(sessions);

    expect(window.localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(sessions));
  });
});
