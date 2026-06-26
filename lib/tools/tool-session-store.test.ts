import { describe, expect, it } from "vitest";
import { selectRecentToolSessions } from "@/lib/tools/tool-session-store";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";

function makeSession(id: string, updatedAt: string, toolId: ToolSessionDetail["toolId"] = "trace-to-cad"): ToolSessionDetail {
  return {
    id,
    toolId,
    title: id,
    createdAt: updatedAt,
    updatedAt,
    outputs: [],
    canPromoteToProject: false,
    status: "draft"
  };
}

describe("selectRecentToolSessions", () => {
  it("returns sessions sorted by updatedAt descending", () => {
    const select = selectRecentToolSessions(2);
    const summaries = select({
      sessions: {
        a: makeSession("a", "2026-01-01T00:00:00.000Z"),
        b: makeSession("b", "2026-01-03T00:00:00.000Z"),
        c: makeSession("c", "2026-01-02T00:00:00.000Z")
      },
      activeSessionId: undefined,
      upsertSession: () => undefined,
      createSession: () => makeSession("new", "2026-01-04T00:00:00.000Z"),
      updateSession: () => undefined,
      promoteSession: () => undefined,
      setActiveSessionId: () => undefined,
      getSession: () => undefined,
      listRecentSessions: () => [],
      appendOutput: () => undefined
    });

    expect(summaries.map((session) => session.id)).toEqual(["b", "c"]);
  });

  it("maps to stable summary fields", () => {
    const select = selectRecentToolSessions(1);
    const session = makeSession("s1", "2026-01-01T00:00:00.000Z", "presentation-generator");
    session.status = "ready";

    const [summary] = select({
      sessions: { s1: session },
      activeSessionId: undefined,
      upsertSession: () => undefined,
      createSession: () => session,
      updateSession: () => undefined,
      promoteSession: () => undefined,
      setActiveSessionId: () => undefined,
      getSession: () => session,
      listRecentSessions: () => [],
      appendOutput: () => undefined
    });

    expect(summary).toEqual({
      id: "s1",
      toolId: "presentation-generator",
      title: "s1",
      status: "ready",
      updatedAt: "2026-01-01T00:00:00.000Z"
    });
  });
});
