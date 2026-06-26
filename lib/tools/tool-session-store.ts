"use client";

import { create } from "zustand";
import { getToolDefinition } from "@/lib/tools/tool-definitions";
import {
  createToolSessionId,
  readToolSessions,
  writeToolSessions
} from "@/lib/tools/tool-session-storage";
import type {
  ToolSession,
  ToolSessionAnalysisMeta,
  ToolSessionInputFile,
  ToolSessionMap,
  ToolSessionOutput,
  ToolSessionSummary
} from "@/lib/tools/tool-session-types";

interface ToolSessionState {
  sessions: ToolSessionMap;
  activeSessionId?: string;
  upsertSession: (session: ToolSession) => void;
  createSession: (toolId: ToolSession["toolId"], title?: string) => ToolSession;
  updateSession: (
    sessionId: string,
    patch: Partial<
      Pick<
        ToolSession,
        | "title"
        | "inputFiles"
        | "parameters"
        | "outputs"
        | "analysisMeta"
        | "status"
        | "canPromoteToProject"
        | "linkedProjectId"
      >
    >
  ) => ToolSession | undefined;
  promoteSession: (sessionId: string, linkedProjectId: string) => ToolSession | undefined;
  setActiveSessionId: (sessionId?: string) => void;
  getSession: (sessionId: string) => ToolSession | undefined;
  listRecentSessions: (limit?: number) => ToolSessionSummary[];
}

function persistSessions(sessions: ToolSessionMap) {
  writeToolSessions(sessions);
}

function toSummary(session: ToolSession): ToolSessionSummary {
  return {
    id: session.id,
    toolId: session.toolId,
    title: session.title,
    status: session.status,
    updatedAt: session.updatedAt
  };
}

export const useToolSessionStore = create<ToolSessionState>((set, get) => ({
  sessions: readToolSessions(),
  activeSessionId: undefined,

  upsertSession: (session) =>
    set((state) => {
      const sessions = { ...state.sessions, [session.id]: session };
      persistSessions(sessions);
      return { sessions, activeSessionId: session.id };
    }),

  createSession: (toolId, title) => {
    const tool = getToolDefinition(toolId);
    const now = new Date().toISOString();
    const session: ToolSession = {
      id: createToolSessionId(),
      toolId,
      title: title ?? tool?.nameZh ?? toolId,
      createdAt: now,
      updatedAt: now,
      canPromoteToProject: false,
      status: "draft"
    };

    get().upsertSession(session);
    return session;
  },

  updateSession: (sessionId, patch) => {
    const current = get().sessions[sessionId];
    if (!current) {
      return undefined;
    }

    const next: ToolSession = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    get().upsertSession(next);
    return next;
  },

  promoteSession: (sessionId, linkedProjectId) =>
    get().updateSession(sessionId, {
      linkedProjectId,
      status: "promoted",
      canPromoteToProject: true
    }),

  setActiveSessionId: (sessionId) => set({ activeSessionId: sessionId }),

  getSession: (sessionId) => get().sessions[sessionId],

  listRecentSessions: (limit = 6) =>
    Object.values(get().sessions)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, limit)
      .map(toSummary)
}));

export function saveTraceToCadSession(input: {
  sessionId: string;
  title: string;
  inputFiles: ToolSessionInputFile[];
  outputs: ToolSessionOutput;
  analysisMeta: ToolSessionAnalysisMeta;
}) {
  return useToolSessionStore.getState().updateSession(input.sessionId, {
    title: input.title,
    inputFiles: input.inputFiles,
    outputs: input.outputs,
    analysisMeta: input.analysisMeta,
    status: "ready",
    canPromoteToProject: true
  });
}
