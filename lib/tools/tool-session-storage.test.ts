import { beforeEach, describe, expect, it, vi } from "vitest";
import { readToolSessions, writeToolSessions } from "@/lib/tools/tool-session-storage";
import type { ToolSessionMap } from "@/lib/tools/tool-session-types";
import { createDemoProjectData } from "@/lib/typologies";

const STORAGE_KEY = "evolab.tool.sessions";

function createSessionMap(): ToolSessionMap {
  return {
    "session-1": {
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      outputs: [],
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

  it("migrates legacy single-object outputs when reading", () => {
    const legacy = {
      "session-legacy": {
        id: "session-legacy",
        toolId: "trace-to-cad",
        title: "legacy.pdf",
        createdAt: "2026-06-26T00:00:00.000Z",
        updatedAt: "2026-06-26T00:00:00.000Z",
        canPromoteToProject: true,
        status: "ready",
        outputs: {
          kind: "plan-version",
          planVersion: createDemoProjectData("office").versions[0]
        }
      }
    };

    window.localStorage.getItem = vi.fn(() => JSON.stringify(legacy));
    const sessions = readToolSessions();

    expect(Array.isArray(sessions["session-legacy"]?.outputs)).toBe(true);
    expect(sessions["session-legacy"]?.outputs[0]?.kind).toBe("plan-version");
  });
});
