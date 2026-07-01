"use client";

import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { PresentationDeck } from "@/lib/presentation/types";
import type { PlanVersion } from "@/lib/project-types";
import { getToolDefinition } from "@/lib/tools/tool-definitions";
import {
  hydrateSessionsFromDetailCache,
  persistSessionDetailCache
} from "@/lib/tools/tool-session-detail-cache";
import {
  createToolSessionId,
  readToolSessions,
  writeToolSessions
} from "@/lib/tools/tool-session-storage";
import type {
  ToolSessionDetail,
  ToolSessionAnalysisMeta,
  ToolSessionInputFile,
  ToolSessionMap,
  ToolSessionOutput,
  ToolSessionSummary
} from "@/lib/tools/tool-session-types";
import {
  normalizeToolSession,
  upsertPlanVersionOutput,
  upsertPresentationDeckOutput
} from "@/lib/tools/tool-session-utils";

interface ToolSessionState {
  sessions: ToolSessionMap;
  activeSessionId?: string;
  upsertSession: (session: ToolSessionDetail) => void;
  createSession: (toolId: ToolSessionDetail["toolId"], title?: string) => ToolSessionDetail;
  updateSession: (
    sessionId: string,
    patch: Partial<
      Pick<
        ToolSessionDetail,
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
  ) => ToolSessionDetail | undefined;
  promoteSession: (sessionId: string, linkedProjectId: string) => ToolSessionDetail | undefined;
  setActiveSessionId: (sessionId?: string) => void;
  getSession: (sessionId: string) => ToolSessionDetail | undefined;
  listRecentSessions: (limit?: number) => ToolSessionSummary[];
  appendOutput: (sessionId: string, output: ToolSessionOutput) => ToolSessionDetail | undefined;
}

function persistSessions(sessions: ToolSessionMap) {
  writeToolSessions(sessions);

  for (const session of Object.values(sessions)) {
    void persistSessionDetailCache(session);
  }
}

function toSummary(session: ToolSessionDetail): ToolSessionSummary {
  return {
    id: session.id,
    toolId: session.toolId,
    title: session.title,
    status: session.status,
    updatedAt: session.updatedAt
  };
}

function recentToolSessionSummaries(sessions: ToolSessionMap, limit: number): ToolSessionSummary[] {
  return Object.values(sessions)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit)
    .map(toSummary);
}

let hydrationStarted = false;

export function hydrateToolSessionStore() {
  if (hydrationStarted || typeof window === "undefined") {
    return;
  }

  hydrationStarted = true;

  const sessions = readToolSessions();
  if (Object.keys(sessions).length > 0) {
    useToolSessionStore.setState({ sessions });
  }

  void hydrateSessionsFromDetailCache(useToolSessionStore.getState().sessions).then((cachedSessions) => {
    if (Object.keys(cachedSessions).length === 0) {
      return;
    }

    useToolSessionStore.setState((state) => ({
      sessions: {
        ...state.sessions,
        ...cachedSessions
      }
    }));
  });
}

function ensureToolSessionsHydrated() {
  hydrateToolSessionStore();
}

export function selectRecentToolSessions(limit = 6) {
  return (state: ToolSessionState): ToolSessionSummary[] =>
    recentToolSessionSummaries(state.sessions, limit);
}

export const useToolSessionStore = create<ToolSessionState>((set, get) => ({
  sessions: {},
  activeSessionId: undefined,

  upsertSession: (session) => {
    ensureToolSessionsHydrated();
    return set((state) => {
      const normalized = normalizeToolSession(session);
      const sessions = { ...state.sessions, [normalized.id]: normalized };
      persistSessions(sessions);
      return { sessions, activeSessionId: normalized.id };
    });
  },

  createSession: (toolId, title) => {
    ensureToolSessionsHydrated();
    const tool = getToolDefinition(toolId);
    const now = new Date().toISOString();
    const session: ToolSessionDetail = {
      id: createToolSessionId(),
      toolId,
      title: title ?? tool?.nameZh ?? toolId,
      createdAt: now,
      updatedAt: now,
      outputs: [],
      canPromoteToProject: false,
      status: "draft"
    };

    get().upsertSession(session);
    return session;
  },

  updateSession: (sessionId, patch) => {
    ensureToolSessionsHydrated();
    const current = get().sessions[sessionId];
    if (!current) {
      return undefined;
    }

    const next: ToolSessionDetail = normalizeToolSession({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    });

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

  getSession: (sessionId) => {
    ensureToolSessionsHydrated();
    return get().sessions[sessionId];
  },

  listRecentSessions: (limit = 6) => {
    ensureToolSessionsHydrated();
    return selectRecentToolSessions(limit)(get());
  },

  appendOutput: (sessionId, output) => {
    ensureToolSessionsHydrated();
    const current = get().sessions[sessionId];
    if (!current) {
      return undefined;
    }

    return get().updateSession(sessionId, {
      outputs: [...current.outputs, output],
      status: "ready",
      canPromoteToProject: true
    });
  }
}));

function pickToolSessionActions(state: ToolSessionState) {
  return {
    createSession: state.createSession,
    getSession: state.getSession,
    promoteSession: state.promoteSession,
    setActiveSessionId: state.setActiveSessionId,
    listRecentSessions: state.listRecentSessions
  };
}

export function useToolSessionActions() {
  return useToolSessionStore(useShallow(pickToolSessionActions));
}

export function useRecentToolSessions(limit = 6) {
  useEffect(() => {
    hydrateToolSessionStore();
  }, []);

  const sessions = useToolSessionStore((state) => state.sessions);
  return useMemo(() => recentToolSessionSummaries(sessions, limit), [limit, sessions]);
}

export function saveTraceToCadSession(input: {
  sessionId: string;
  title: string;
  inputFiles: ToolSessionInputFile[];
  draftPlanVersion: PlanVersion;
  recognizedPlanVersion: PlanVersion;
  referencePreviewUrl?: string;
  analysisMeta: ToolSessionAnalysisMeta;
}) {
  const current = useToolSessionStore.getState().getSession(input.sessionId);
  const outputs = upsertPlanVersionOutput(current?.outputs ?? [], {
    label: input.title,
    planVersion: input.draftPlanVersion,
    recognizedPlanVersion: input.recognizedPlanVersion,
    referencePreviewUrl: input.referencePreviewUrl
  });

  return useToolSessionStore.getState().updateSession(input.sessionId, {
    title: input.title,
    inputFiles: input.inputFiles.map((file) => ({
      ...file,
      previewUrl: file.previewUrl ?? input.referencePreviewUrl
    })),
    outputs,
    analysisMeta: input.analysisMeta,
    status: "ready",
    canPromoteToProject: true
  });
}

export function saveRetainedStructureRemixSession(input: {
  sessionId: string;
  title: string;
  sourceLabel: string;
  sourceVersion: PlanVersion;
  remixedVersion?: PlanVersion;
  parameters?: Record<string, string | number | boolean>;
}) {
  const current = useToolSessionStore.getState().getSession(input.sessionId);
  const outputs = input.remixedVersion
    ? upsertPlanVersionOutput(current?.outputs ?? [], {
        label: input.title,
        planVersion: input.remixedVersion,
        sourcePlanVersion: input.sourceVersion
      })
    : current?.outputs ?? [];

  return useToolSessionStore.getState().updateSession(input.sessionId, {
    title: input.title,
    inputFiles: [{ fileName: input.sourceLabel, sourceType: "plan-version" }],
    parameters: input.parameters,
    outputs,
    status: input.remixedVersion ? "ready" : "draft",
    canPromoteToProject: Boolean(input.remixedVersion)
  });
}

export function savePresentationGeneratorSession(input: {
  sessionId: string;
  title: string;
  sourceLabel: string;
  deck: PresentationDeck;
  parameters?: Record<string, string | number | boolean>;
  planVersion?: PlanVersion;
}) {
  const current = useToolSessionStore.getState().getSession(input.sessionId);
  let outputs = upsertPresentationDeckOutput(current?.outputs ?? [], {
    label: input.title,
    deck: input.deck
  });

  if (input.planVersion) {
    outputs = upsertPlanVersionOutput(outputs, {
      label: input.sourceLabel,
      planVersion: input.planVersion
    });
  }

  return useToolSessionStore.getState().updateSession(input.sessionId, {
    title: input.title,
    inputFiles: [{ fileName: input.sourceLabel, sourceType: "presentation-source" }],
    parameters: input.parameters,
    outputs,
    status: "ready",
    canPromoteToProject: true
  });
}
