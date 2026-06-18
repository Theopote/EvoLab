"use client";

import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { OpeningInspector } from "@/components/inspector/OpeningInspector";
import { ProjectInspector } from "@/components/inspector/ProjectInspector";
import { RoomInspector } from "@/components/inspector/RoomInspector";
import { WallInspector } from "@/components/inspector/WallInspector";
import { useEvoProject } from "@/lib/project-store";

export function InspectorPanel() {
  const { selectionType, selectedRoom, selectedWall, selectedOpening, clearSelection } = useEvoProject(
    useShallow((state) => ({
      selectionType: state.selectionType,
      selectedRoom: state.selectedRoom,
      selectedWall: state.selectedWall,
      selectedOpening: state.selectedOpening,
      clearSelection: state.clearSelection
    }))
  );

  const selectionLabel =
    selectionType === "room"
      ? selectedRoom?.name ?? selectedRoom?.id
      : selectionType === "wall"
      ? selectedWall?.id
      : selectionType === "opening"
      ? selectedOpening?.id
      : "project";

  const isSelectionActive = selectionType !== "none";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isSelectionActive) {
        clearSelection();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, isSelectionActive]);

  return (
    <div className="space-y-3">
      <section className="rounded border border-line bg-panel/90 p-3 text-xs text-muted">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            Selection: <span className="text-slate-100">{selectionLabel}</span>
          </span>
          <button
            className="rounded border border-line px-2 py-1 text-[11px] text-slate-200 disabled:opacity-40"
            disabled={!isSelectionActive}
            type="button"
            onClick={clearSelection}
          >
            Clear
          </button>
        </div>
      </section>

      {selectionType === "room" && selectedRoom ? <RoomInspector /> : null}
      {selectionType === "wall" && selectedWall ? <WallInspector /> : null}
      {selectionType === "opening" && selectedOpening ? <OpeningInspector /> : null}
      {selectionType === "none" ? <ProjectInspector /> : null}
    </div>
  );
}
