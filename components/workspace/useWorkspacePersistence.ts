"use client";

import { useEffect, useRef } from "react";
import { useEvoProjectStore } from "@/lib/store/store";
import { buildWorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import {
  readWorkspaceSnapshot,
  writeWorkspaceSnapshot,
  WORKSPACE_SNAPSHOT_KEY
} from "@/lib/store/workspace-persistence";

const SAVE_DEBOUNCE_MS = 400;

export function useWorkspacePersistence(options?: { skipRestore?: boolean }) {
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrateWorkspaceSnapshot = useEvoProjectStore((state) => state.hydrateWorkspaceSnapshot);

  useEffect(() => {
    if (options?.skipRestore || hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;

    void readWorkspaceSnapshot(WORKSPACE_SNAPSHOT_KEY).then((snapshot) => {
      if (snapshot?.project?.versions?.length) {
        hydrateWorkspaceSnapshot(snapshot);
      }
    });
  }, [hydrateWorkspaceSnapshot, options?.skipRestore]);

  useEffect(() => {
    const unsubscribe = useEvoProjectStore.subscribe((state, previousState) => {
      if (
        state.project === previousState.project &&
        state.brief === previousState.brief &&
        state.workflowPhase === previousState.workflowPhase &&
        state.activeTab === previousState.activeTab &&
        state.outline === previousState.outline &&
        state.outlineClosed === previousState.outlineClosed &&
        state.zoning === previousState.zoning
      ) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        const snapshot = buildWorkspacePersistedSnapshot(useEvoProjectStore.getState());
        void writeWorkspaceSnapshot(snapshot);
      }, SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);
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
