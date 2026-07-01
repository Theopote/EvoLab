"use client";

import { useEffect, useRef, useState } from "react";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { fetchProjectSnapshot, saveProjectSnapshot } from "@/lib/project-sync-client";
import { useEvoProjectStore } from "@/lib/store/store";
import { buildWorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import { readWorkspaceSnapshot, writeWorkspaceSnapshot } from "@/lib/store/workspace-persistence";

const SAVE_DEBOUNCE_MS = 400;
const SERVER_SYNC_DEBOUNCE_MS = 1500;

export function useWorkspaceHydration(options?: { skipRestore?: boolean; preferredProjectId?: string | null }) {
  const [isReady, setIsReady] = useState(() => Boolean(options?.skipRestore || !options?.preferredProjectId?.trim()));
  const hydratedProjectIdRef = useRef<string | null>(null);
  const hydrateWorkspaceSnapshot = useEvoProjectStore((state) => state.hydrateWorkspaceSnapshot);

  useEffect(() => {
    if (options?.skipRestore) {
      setIsReady(true);
      return;
    }

    const projectId = options?.preferredProjectId?.trim() || useEvoProjectStore.getState().project.projectId;

    if (!projectId) {
      setIsReady(true);
      return;
    }

    if (hydratedProjectIdRef.current === projectId) {
      setIsReady(true);
      return;
    }

    hydratedProjectIdRef.current = projectId;
    setIsReady(false);

    void (async () => {
      const remoteSnapshot = await fetchProjectSnapshot(projectId);
      const localSnapshot = await readWorkspaceSnapshot(projectId);
      const snapshot = pickNewestSnapshot(remoteSnapshot, localSnapshot);

      if (snapshot) {
        hydrateWorkspaceSnapshot(snapshot);
        if (snapshot.copilotTimelineEntries?.length) {
          useCopilotTimelineStore.getState().hydrateEntries(snapshot.copilotTimelineEntries);
        }
      }

      setIsReady(true);
    })();
  }, [hydrateWorkspaceSnapshot, options?.preferredProjectId, options?.skipRestore]);

  return isReady;
}

export function useWorkspacePersistence() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = useEvoProjectStore.subscribe((state, previousState) => {
      if (
        state.project === previousState.project &&
        state.brief === previousState.brief &&
        state.workflowPhase === previousState.workflowPhase &&
        state.activeTab === previousState.activeTab &&
        state.outline === previousState.outline &&
        state.outlineClosed === previousState.outlineClosed &&
        state.zoning === previousState.zoning &&
        state.undoStack === previousState.undoStack
      ) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      if (serverTimerRef.current) {
        clearTimeout(serverTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const snapshot = buildWorkspacePersistedSnapshot(
          useEvoProjectStore.getState(),
          useCopilotTimelineStore.getState().entries
        );
        void writeWorkspaceSnapshot(snapshot);
      }, SAVE_DEBOUNCE_MS);

      serverTimerRef.current = setTimeout(() => {
        const snapshot = buildWorkspacePersistedSnapshot(
          useEvoProjectStore.getState(),
          useCopilotTimelineStore.getState().entries
        );
        void saveProjectSnapshot(snapshot);
      }, SERVER_SYNC_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (serverTimerRef.current) {
        clearTimeout(serverTimerRef.current);
      }
    };
  }, []);
}

function pickNewestSnapshot(
  remote: Awaited<ReturnType<typeof fetchProjectSnapshot>>,
  local: Awaited<ReturnType<typeof readWorkspaceSnapshot>>
) {
  if (!remote) {
    return local;
  }

  if (!local) {
    return remote;
  }

  return remote.savedAt >= local.savedAt ? remote : local;
}

export function useWorkspaceEditHistoryShortcuts() {
  const undoProjectEdit = useEvoProjectStore((state) => state.undoProjectEdit);
  const redoProjectEdit = useEvoProjectStore((state) => state.redoProjectEdit);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;

      if (!mod || event.altKey) {
        return;
      }

      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoProjectEdit();
        return;
      }

      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoProjectEdit();
        return;
      }

      if (key === "y") {
        event.preventDefault();
        redoProjectEdit();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoProjectEdit, undoProjectEdit]);
}
