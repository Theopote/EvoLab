"use client";

import { Columns2, Merge, Rows2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Room } from "@/lib/project-types";
import { canSplitRectRoom, findMergeableNeighborIds } from "@/lib/room-topology-ops";

interface RoomTopologyToolbarProps {
  room: Room;
  rooms: Room[];
  disabled?: boolean;
  onSplit: (input: {
    axis: "horizontal" | "vertical";
    splitRatio: number;
    secondRoomName: string;
  }) => void;
  onMerge: (neighborRoomId: string, mergedName?: string) => void;
}

export function RoomTopologyToolbar({
  room,
  rooms,
  disabled = false,
  onSplit,
  onMerge
}: RoomTopologyToolbarProps) {
  const [splitRatio, setSplitRatio] = useState(50);
  const [secondRoomName, setSecondRoomName] = useState(`${room.name} B`);
  const [mergedName, setMergedName] = useState(room.name);
  const mergeableNeighborIds = useMemo(() => findMergeableNeighborIds(room.id, rooms), [room.id, rooms]);
  const mergeableNeighbors = mergeableNeighborIds
    .map((roomId) => rooms.find((item) => item.id === roomId))
    .filter((item): item is Room => Boolean(item));
  const [neighborId, setNeighborId] = useState(mergeableNeighbors[0]?.id ?? "");
  const splittable = canSplitRectRoom(room);

  return (
    <div className="mb-3 rounded border border-line bg-panel/90 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">Room topology</div>
      <p className="mb-3 text-xs text-muted">
        Split or merge rectangular rooms along shared walls. Geometry commits immediately and syncs walls, openings, and
        quantities through normalize.
      </p>

      <div className="grid gap-3 border-b border-line/70 pb-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Split</div>
        <label className="block text-xs text-muted">
          New room name
          <input
            className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
            disabled={disabled || !splittable}
            value={secondRoomName}
            onChange={(event) => setSecondRoomName(event.target.value)}
          />
        </label>
        <label className="block text-xs text-muted">
          Split ratio ({splitRatio}%)
          <input
            className="mt-1 w-full"
            disabled={disabled || !splittable}
            max={85}
            min={15}
            type="range"
            value={splitRatio}
            onChange={(event) => setSplitRatio(Number(event.target.value))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !splittable}
            type="button"
            onClick={() =>
              onSplit({
                axis: "vertical",
                splitRatio: splitRatio / 100,
                secondRoomName: secondRoomName.trim() || `${room.name} B`
              })
            }
          >
            <Columns2 className="h-3.5 w-3.5" />
            Split vertical
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled || !splittable}
            type="button"
            onClick={() =>
              onSplit({
                axis: "horizontal",
                splitRatio: splitRatio / 100,
                secondRoomName: secondRoomName.trim() || `${room.name} B`
              })
            }
          >
            <Rows2 className="h-3.5 w-3.5" />
            Split horizontal
          </button>
        </div>
        {!splittable ? <div className="text-[11px] text-warning">Room must be at least 2 m in both axes to split.</div> : null}
      </div>

      <div className="grid gap-3 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Merge</div>
        {mergeableNeighbors.length ? (
          <>
            <label className="block text-xs text-muted">
              Neighbor room
              <select
                className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
                disabled={disabled}
                value={neighborId}
                onChange={(event) => {
                  const nextNeighbor = mergeableNeighbors.find((item) => item.id === event.target.value);
                  setNeighborId(event.target.value);
                  if (nextNeighbor) {
                    setMergedName(`${room.name} + ${nextNeighbor.name}`);
                  }
                }}
              >
                {mergeableNeighbors.map((neighbor) => (
                  <option key={neighbor.id} value={neighbor.id}>
                    {neighbor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-muted">
              Merged room name
              <input
                className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
                disabled={disabled}
                value={mergedName}
                onChange={(event) => setMergedName(event.target.value)}
              />
            </label>
            <button
              className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || !neighborId}
              type="button"
              onClick={() => onMerge(neighborId, mergedName.trim() || undefined)}
            >
              <Merge className="h-3.5 w-3.5" />
              Merge with neighbor
            </button>
          </>
        ) : (
          <div className="text-[11px] text-muted">No adjacent room shares a full wall with this room.</div>
        )}
      </div>
    </div>
  );
}
