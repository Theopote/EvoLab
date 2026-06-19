"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  findOpeningWall,
  wallLength
} from "@/components/floor-plan/floor-plan-utils";
import {
  openingCenterFromPosition,
  openingFitsOnWall,
  openingPositionLimits,
  openingPositionOnWall
} from "@/lib/opening-wall-utils";
import { useEvoProject } from "@/lib/project-store";

export function OpeningInspector() {
  const { selectedOpening, activeLevel, lockedElementIds, updateOpening } = useEvoProject(
    useShallow((state) => ({
      selectedOpening: state.selectedOpening,
      activeLevel: state.activeLevel,
      lockedElementIds: state.project.domain.lockedElementIds,
      updateOpening: state.updateOpening
    }))
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef<string>("");
  const lastCommittedOpeningRef = useRef<string>("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    width: "0",
    position: "0.5"
  });

  const wall = selectedOpening && activeLevel ? findOpeningWall(selectedOpening, activeLevel.walls) : undefined;
  const isLocked =
    Boolean(selectedOpening) &&
    (lockedElementIds.includes(selectedOpening!.id) ||
      (selectedOpening!.roomIds ?? []).some((roomId) => lockedElementIds.includes(roomId)));

  useEffect(() => {
    if (!selectedOpening || !wall) {
      return;
    }

    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }

    setDraft({
      width: selectedOpening.width.toFixed(2),
      position: openingPositionOnWall(selectedOpening, wall).toFixed(3)
    });
    lastCommittedRef.current = "";
    lastCommittedOpeningRef.current = selectedOpening.id;
    setSaveState("idle");
  }, [selectedOpening, wall]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (idleRef.current) {
        clearTimeout(idleRef.current);
      }
    };
  }, []);

  const parsedWidth = Number(draft.width);
  const parsedPosition = Number(draft.position);
  const wallLengthMeters = wall ? wallLength(wall) : 0;
  const positionLimits = wall ? openingPositionLimits(wall, parsedWidth) : undefined;

  const errors = {
    width:
      Number.isFinite(parsedWidth) && parsedWidth >= 0.4 && parsedWidth <= 6
        ? wall && parsedWidth > wallLengthMeters - 0.1
          ? `width must fit on wall (${wallLengthMeters.toFixed(2)} m)`
          : undefined
        : "width must be between 0.4 and 6 m",
    position:
      Number.isFinite(parsedPosition) && parsedPosition >= 0.05 && parsedPosition <= 0.95
        ? wall && !openingFitsOnWall(wall, parsedWidth, parsedPosition)
          ? positionLimits
            ? `position must be ${positionLimits.min.toFixed(2)}–${positionLimits.max.toFixed(2)} for this width`
            : "opening does not fit on wall"
          : undefined
        : "position must be between 0.05 and 0.95"
  };

  const hasErrors = Boolean(errors.width || errors.position || !wall);

  const hasChanges =
    Boolean(selectedOpening && wall) &&
    (draft.width !== selectedOpening!.width.toFixed(2) ||
      draft.position !== openingPositionOnWall(selectedOpening!, wall!).toFixed(3));

  const dirty = {
    width: draft.width !== (selectedOpening?.width.toFixed(2) ?? ""),
    position:
      Boolean(selectedOpening && wall) &&
      draft.position !== openingPositionOnWall(selectedOpening!, wall!).toFixed(3)
  };

  const canSave = hasChanges && !hasErrors && !isLocked;

  const patch = useMemo(() => {
    if (!wall) {
      return null;
    }

    return {
      width: parsedWidth,
      center: openingCenterFromPosition(wall, parsedPosition)
    };
  }, [parsedPosition, parsedWidth, wall]);

  function setIdleDelayed() {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
    }

    idleRef.current = setTimeout(() => setSaveState("idle"), 900);
  }

  function persistDraft() {
    if (!selectedOpening || !patch || !canSave) {
      return false;
    }

    const commitKey = `${selectedOpening.id}:${JSON.stringify(patch)}`;

    if (lastCommittedRef.current === commitKey && lastCommittedOpeningRef.current === selectedOpening.id) {
      return false;
    }

    setSaveState("saving");
    updateOpening(selectedOpening.id, patch);
    lastCommittedRef.current = commitKey;
    lastCommittedOpeningRef.current = selectedOpening.id;
    setSaveState("saved");
    setIdleDelayed();
    return true;
  }

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    if (!hasChanges) {
      if (saveState !== "saved") {
        setSaveState("idle");
      }
      return;
    }

    if (hasErrors || isLocked) {
      setSaveState("dirty");
      return;
    }

    setSaveState("dirty");
    debounceRef.current = setTimeout(() => {
      persistDraft();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [canSave, hasChanges, hasErrors, isLocked, patch, selectedOpening?.id, saveState]);

  if (!selectedOpening) {
    return null;
  }

  const opening = selectedOpening;

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied((current) => (current === label ? null : current)), 1200);
    } catch {
      setCopied(null);
    }
  }

  function handleSave() {
    persistDraft();
  }

  function handleAutoSaveOnBlur() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    persistDraft();
  }

  function handleReset() {
    if (!wall) {
      return;
    }

    setDraft({
      width: opening.width.toFixed(2),
      position: openingPositionOnWall(opening, wall).toFixed(3)
    });
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <div className="flex items-center gap-2">
          <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Opening</span>
          <span className="rounded border border-line px-2 py-1 text-[11px] text-muted">
            {saveState === "saving"
              ? "saving"
              : saveState === "saved"
                ? "saved"
                : saveState === "dirty"
                  ? "draft"
                  : "synced"}
          </span>
        </div>
      </div>

      {isLocked ? (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-2 text-xs text-warning">
          This opening or its parent room is locked.
        </div>
      ) : null}

      {!wall ? (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-2 text-xs text-warning">
          Parent wall not found. Geometry edits are disabled.
        </div>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button
          className="h-8 rounded border border-accent/40 text-xs text-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canSave}
          type="button"
          onClick={handleSave}
        >
          Save changes
        </button>
        <button
          className="h-8 rounded border border-line text-xs text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasChanges}
          type="button"
          onClick={handleReset}
        >
          Reset
        </button>
      </div>

      {hasErrors && hasChanges ? (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-2 text-xs text-warning">
          Fix validation issues before saving.
        </div>
      ) : null}

      <p className="mb-3 text-[11px] text-muted">
        Position is measured along the parent wall (0 = start, 1 = end). Edits auto-save on pause.
      </p>

      <div className="space-y-3 text-sm">
        <ReadOnlyField label="id" value={opening.id} />
        <ReadOnlyField label="type" value={opening.type} />
        <ReadOnlyField
          label="wallId"
          value={opening.wallId}
          canCopy
          copied={copied === "wallId"}
          onCopy={() => copyValue("wallId", opening.wallId)}
        />
        <ReadOnlyField label="wall length" value={wall ? `${wallLengthMeters.toFixed(2)} m` : "-"} />
        <NumberField
          label="width (m)"
          value={draft.width}
          step={0.05}
          min={0.4}
          max={6}
          dirty={dirty.width}
          disabled={isLocked || !wall}
          onChange={(value) => setDraft((current) => ({ ...current, width: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        {errors.width ? <FieldError message={errors.width} /> : null}
        <NumberField
          label="position (0–1)"
          value={draft.position}
          step={0.01}
          min={positionLimits?.min ?? 0.05}
          max={positionLimits?.max ?? 0.95}
          dirty={dirty.position}
          disabled={isLocked || !wall}
          onChange={(value) => setDraft((current) => ({ ...current, position: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        {errors.position ? <FieldError message={errors.position} /> : null}
        <ReadOnlyField label="height" value={`${opening.height.toFixed(2)} m`} />
        <ReadOnlyField label="sillHeight" value={`${(opening.sillHeight ?? 0).toFixed(2)} m`} />
      </div>
    </section>
  );
}

function ReadOnlyField({
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
    <div>
      <label className="mb-1 flex items-center justify-between text-xs uppercase tracking-wide text-muted">
        <span>{label}</span>
        {canCopy ? (
          <button
            className="rounded border border-line px-1.5 py-0.5 text-[10px] normal-case text-slate-200"
            type="button"
            onClick={onCopy}
          >
            {copied ? "copied" : "copy"}
          </button>
        ) : null}
      </label>
      <div className="rounded border border-line bg-black/20 px-2 py-2 text-slate-200">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  dirty,
  disabled,
  onChange,
  onBlur
}: {
  label: string;
  value: string;
  min?: number;
  max?: number;
  step?: number;
  dirty?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        className={`w-full rounded border px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50 ${
          dirty ? "border-accent/60 bg-accent/5" : "border-line bg-black/20"
        }`}
        disabled={disabled}
        max={max}
        min={min}
        step={step}
        type="number"
        value={value}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="-mt-2 text-xs text-warning">{message}</p>;
}
