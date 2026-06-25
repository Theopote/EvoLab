"use client";

import { useMemo, useState } from "react";
import { Merge, Scissors } from "lucide-react";
import { wallLength } from "@/components/floor-plan/floor-plan-utils";
import { findMergeableWallIds } from "@/lib/geometry/walls/apply-wall-topology";
import {
  useGeometryActions,
  useProjectState,
  useReviewState,
  useSelectionState
} from "@/lib/project-store";

const MIN_SPLIT_WALL_LENGTH = 1.2;

export function WallInspector() {
  const selectedWall = useSelectionState((state) => state.selectedWall);
  const activeLevel = useProjectState((state) => state.activeLevel);
  const lockedElementIds = useReviewState((state) => state.lockedElementIds);
  const { mergeSelectedWallWith, splitSelectedWallAt } = useGeometryActions();
  const [copied, setCopied] = useState<string | null>(null);
  const [splitParam, setSplitParam] = useState(50);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const mergeableWallIds = useMemo(
    () => (selectedWall && activeLevel ? findMergeableWallIds(activeLevel.walls, selectedWall.id) : []),
    [activeLevel, selectedWall]
  );

  const mergeableWalls = useMemo(
    () =>
      mergeableWallIds
        .map((wallId) => activeLevel?.walls.find((wall) => wall.id === wallId))
        .filter((wall): wall is NonNullable<typeof wall> => Boolean(wall)),
    [activeLevel?.walls, mergeableWallIds]
  );

  const resolvedMergeTargetId = mergeTargetId || mergeableWalls[0]?.id || "";
  const lengthMeters = selectedWall ? wallLength(selectedWall) : 0;
  const splittable = lengthMeters >= MIN_SPLIT_WALL_LENGTH;
  const isLocked =
    Boolean(selectedWall) &&
    (lockedElementIds.includes(selectedWall!.id) ||
      selectedWall!.roomIds.some((roomId) => lockedElementIds.includes(roomId)));

  if (!selectedWall) {
    return null;
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((current) => (current === label ? null : current)), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Wall</span>
      </div>

      <dl className="mb-4 space-y-3 text-sm">
        <Info label="id" value={selectedWall.id} canCopy copied={copied === "id"} onCopy={() => copyValue("id", selectedWall.id)} />
        <Info label="type" value={selectedWall.type} />
        <Info label="thickness" value={`${selectedWall.thickness.toFixed(2)} m`} />
        <Info label="height" value={`${selectedWall.height.toFixed(2)} m`} />
        <Info label="length" value={`${lengthMeters.toFixed(2)} m`} />
        <Info
          label="roomIds"
          value={selectedWall.roomIds.join(", ") || "-"}
          canCopy
          copied={copied === "roomIds"}
          onCopy={() => copyValue("roomIds", selectedWall.roomIds.join(", "))}
        />
      </dl>

      <div className="rounded border border-line/80 bg-black/10 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100">Wall topology</div>
        <p className="mb-3 text-xs text-muted">
          Split inserts a shared vertex on room edges. Merge joins collinear segments that share an endpoint.
        </p>

        {isLocked ? (
          <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-2 text-xs text-warning">
            This wall or a connected room is locked.
          </div>
        ) : null}

        <div className="grid gap-3 border-b border-line/70 pb-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Split</div>
          <label className="block text-xs text-muted">
            Split position ({splitParam}% along wall)
            <input
              className="mt-1 w-full"
              disabled={isLocked || !splittable}
              max={90}
              min={10}
              type="range"
              value={splitParam}
              onChange={(event) => setSplitParam(Number(event.target.value))}
            />
          </label>
          <button
            className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLocked || !splittable}
            type="button"
            onClick={() => splitSelectedWallAt(splitParam / 100)}
          >
            <Scissors className="h-3.5 w-3.5" />
            Split wall
          </button>
          {!splittable ? (
            <div className="text-[11px] text-warning">
              Wall must be at least {MIN_SPLIT_WALL_LENGTH.toFixed(1)} m long to split.
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 pt-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Merge</div>
          {mergeableWalls.length ? (
            <>
              <label className="block text-xs text-muted">
                Collinear neighbor
                <select
                  className="mt-1 w-full rounded border border-line bg-[#0b1118] px-2 py-2 text-sm text-slate-100"
                  disabled={isLocked}
                  value={resolvedMergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                >
                  {mergeableWalls.map((wall) => (
                    <option key={wall.id} value={wall.id}>
                      {wall.id} · {wallLength(wall).toFixed(2)} m
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-9 items-center gap-2 rounded border border-accent/40 px-3 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLocked || !resolvedMergeTargetId}
                type="button"
                onClick={() => mergeSelectedWallWith(resolvedMergeTargetId)}
              >
                <Merge className="h-3.5 w-3.5" />
                Merge with neighbor
              </button>
            </>
          ) : (
            <div className="text-[11px] text-muted">No collinear wall shares an endpoint with this segment.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Info({
  label,
  value,
  canCopy,
  copied,
  onCopy
}: {
  label: string;
  value: string;
  canCopy?: boolean;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-3">
      <dt className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {canCopy ? (
          <button
            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-slate-200"
            type="button"
            onClick={onCopy}
          >
            {copied ? "copied" : "copy"}
          </button>
        ) : null}
      </dt>
      <dd className="mt-1 break-all text-slate-100">{value}</dd>
    </div>
  );
}
