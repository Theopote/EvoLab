import { beforeEach, describe, expect, it, vi } from "vitest";
import { readToolSessions, writeToolSessions } from "@/lib/tools/tool-session-storage";
import { toStoredSession } from "@/lib/tools/tool-session-persist";
import type { ToolSessionDetail, ToolSessionMap } from "@/lib/tools/tool-session-types";
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
    const stored = { "session-1": toStoredSession(sessions["session-1"]!) };
    window.localStorage.getItem = vi.fn(() => JSON.stringify(stored));

    expect(readToolSessions()["session-1"]).toMatchObject({
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD"
    });
  });

  it("writes lightweight stored sessions to localStorage", () => {
    const sessions = createSessionMap();
    writeToolSessions(sessions);

    const payload = JSON.parse(String((window.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]));
    expect(payload["session-1"]).toEqual(toStoredSession(sessions["session-1"]!));
    expect(JSON.stringify(payload)).not.toContain("data:image");
  });

  it("migrates legacy single-object outputs and strips inline previews when reading", () => {
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
          planVersion: createDemoProjectData("office").versions[0],
          referencePreviewUrl: "data:image/png;base64,abc"
        }
      }
    };

    window.localStorage.getItem = vi.fn(() => JSON.stringify(legacy));
    const sessions = readToolSessions();

    expect(Array.isArray(sessions["session-legacy"]?.outputs)).toBe(true);
    expect(sessions["session-legacy"]?.outputs[0]?.kind).toBe("plan-version");
    expect(
      sessions["session-legacy"]?.outputs[0]?.kind === "plan-version"
        ? sessions["session-legacy"]?.outputs[0]?.referencePreviewUrl
        : undefined
    ).toBeUndefined();

    const migratedPayload = JSON.parse(String((window.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]));
    expect(JSON.stringify(migratedPayload)).not.toContain("data:image");
  });
});
