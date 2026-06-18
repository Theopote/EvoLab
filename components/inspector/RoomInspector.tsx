"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { FunctionZone, RoomType } from "@/lib/project-types";
import { useEvoProject } from "@/lib/project-store";

const roomTypes: RoomType[] = [
  "lobby",
  "corridor",
  "consultation",
  "ward",
  "office",
  "living_room",
  "bedroom",
  "kitchen",
  "bathroom",
  "stair",
  "elevator",
  "shaft",
  "equipment_room",
  "other"
];

const zones: FunctionZone[] = ["public", "semi_public", "private", "service", "circulation"];

export function RoomInspector() {
  const { selectedRoom, updateRoom } = useEvoProject(
    useShallow((state) => ({
      selectedRoom: state.selectedRoom,
      updateRoom: state.updateRoom
    }))
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCommittedRef = useRef<string>("");
  const lastCommittedRoomRef = useRef<string>("");
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved">("idle");

  const [draft, setDraft] = useState({
    name: "",
    type: "other" as RoomType,
    zone: "private" as FunctionZone,
    areaSqm: "0",
    ceilingHeight: "3",
    orientation: "",
    needsDaylight: false,
    needsPlumbing: false
  });

  useEffect(() => {
    if (!selectedRoom) {
      return;
    }

    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }

    setDraft({
      name: selectedRoom.name,
      type: selectedRoom.type,
      zone: selectedRoom.zone,
      areaSqm: String(selectedRoom.areaSqm),
      ceilingHeight: String(selectedRoom.ceilingHeight),
      orientation: selectedRoom.orientation ?? "",
      needsDaylight: Boolean(selectedRoom.needsDaylight),
      needsPlumbing: Boolean(selectedRoom.needsPlumbing)
    });

    lastCommittedRef.current = "";
    lastCommittedRoomRef.current = selectedRoom.id;
    setSaveState("idle");
  }, [selectedRoom]);

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

  if (!selectedRoom) {
    return null;
  }

  const room = selectedRoom;

  const parsedArea = Number(draft.areaSqm);
  const parsedCeiling = Number(draft.ceilingHeight);
  const errors = {
    name: draft.name.trim().length === 0 ? "name cannot be empty" : undefined,
    areaSqm: Number.isFinite(parsedArea) && parsedArea > 0 ? undefined : "areaSqm must be > 0",
    ceilingHeight:
      Number.isFinite(parsedCeiling) && parsedCeiling >= 2 && parsedCeiling <= 8
        ? undefined
        : "ceilingHeight should be between 2 and 8"
  };
  const hasErrors = Boolean(errors.name || errors.areaSqm || errors.ceilingHeight);
  const hasChanges =
    draft.name !== room.name ||
    draft.type !== room.type ||
    draft.zone !== room.zone ||
    draft.areaSqm !== String(room.areaSqm) ||
    draft.ceilingHeight !== String(room.ceilingHeight) ||
    draft.orientation !== (room.orientation ?? "") ||
    draft.needsDaylight !== Boolean(room.needsDaylight) ||
    draft.needsPlumbing !== Boolean(room.needsPlumbing);
  const dirty = {
    name: draft.name !== room.name,
    type: draft.type !== room.type,
    zone: draft.zone !== room.zone,
    areaSqm: draft.areaSqm !== String(room.areaSqm),
    ceilingHeight: draft.ceilingHeight !== String(room.ceilingHeight),
    orientation: draft.orientation !== (room.orientation ?? ""),
    needsDaylight: draft.needsDaylight !== Boolean(room.needsDaylight),
    needsPlumbing: draft.needsPlumbing !== Boolean(room.needsPlumbing)
  };

  const canSave = hasChanges && !hasErrors;

  const patch = useMemo(
    () => ({
      name: draft.name.trim(),
      type: draft.type,
      zone: draft.zone,
      areaSqm: Number(draft.areaSqm),
      ceilingHeight: Number(draft.ceilingHeight),
      orientation: draft.orientation.trim() || undefined,
      needsDaylight: draft.needsDaylight,
      needsPlumbing: draft.needsPlumbing
    }),
    [draft]
  );

  function setIdleDelayed() {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
    }
    idleRef.current = setTimeout(() => setSaveState("idle"), 900);
  }

  function persistDraft() {
    if (!canSave) {
      return false;
    }

    const commitKey = `${room.id}:${JSON.stringify(patch)}`;

    if (lastCommittedRef.current === commitKey && lastCommittedRoomRef.current === room.id) {
      return false;
    }

    setSaveState("saving");
    updateRoom(room.id, patch);
    lastCommittedRef.current = commitKey;
    lastCommittedRoomRef.current = room.id;
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

    if (hasErrors) {
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
  }, [canSave, hasChanges, hasErrors, patch, room.id, saveState]);

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
    setDraft({
      name: room.name,
      type: room.type,
      zone: room.zone,
      areaSqm: String(room.areaSqm),
      ceilingHeight: String(room.ceilingHeight),
      orientation: room.orientation ?? "",
      needsDaylight: Boolean(room.needsDaylight),
      needsPlumbing: Boolean(room.needsPlumbing)
    });
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <div className="flex items-center gap-2">
          <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Room</span>
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

      {hasErrors ? (
        <div className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-2 text-xs text-warning">
          Fix validation issues before saving.
        </div>
      ) : null}

      <p className="mb-3 text-[11px] text-muted">Edits auto-save on pause (300ms) and when a field loses focus.</p>

      <div className="space-y-3 text-sm">
        <ReadOnlyField label="id" value={room.id} />
        <TextField
          label="name"
          value={draft.name}
          dirty={dirty.name}
          onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        {errors.name ? <FieldError message={errors.name} /> : null}
        <SelectField
          label="type"
          value={draft.type}
          options={roomTypes}
          dirty={dirty.type}
          onChange={(value) => setDraft((current) => ({ ...current, type: value as RoomType }))}
          onBlur={handleAutoSaveOnBlur}
        />
        <SelectField
          label="zone"
          value={draft.zone}
          options={zones}
          dirty={dirty.zone}
          onChange={(value) => setDraft((current) => ({ ...current, zone: value as FunctionZone }))}
          onBlur={handleAutoSaveOnBlur}
        />
        <NumberField
          label="areaSqm"
          value={draft.areaSqm}
          step={0.1}
          min={0}
          dirty={dirty.areaSqm}
          onChange={(value) => setDraft((current) => ({ ...current, areaSqm: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        {errors.areaSqm ? <FieldError message={errors.areaSqm} /> : null}
        <NumberField
          label="ceilingHeight"
          value={draft.ceilingHeight}
          step={0.1}
          min={2}
          dirty={dirty.ceilingHeight}
          onChange={(value) => setDraft((current) => ({ ...current, ceilingHeight: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        {errors.ceilingHeight ? <FieldError message={errors.ceilingHeight} /> : null}
        <TextField
          label="orientation"
          value={draft.orientation}
          dirty={dirty.orientation}
          onChange={(value) => setDraft((current) => ({ ...current, orientation: value }))}
          onBlur={handleAutoSaveOnBlur}
        />
        <ToggleField
          label="needsDaylight"
          checked={draft.needsDaylight}
          dirty={dirty.needsDaylight}
          onChange={(checked) => setDraft((current) => ({ ...current, needsDaylight: checked }))}
          onBlur={handleAutoSaveOnBlur}
        />
        <ToggleField
          label="needsPlumbing"
          checked={draft.needsPlumbing}
          dirty={dirty.needsPlumbing}
          onChange={(checked) => setDraft((current) => ({ ...current, needsPlumbing: checked }))}
          onBlur={handleAutoSaveOnBlur}
        />
      </div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <div className="rounded border border-line bg-black/20 px-2 py-2 text-slate-200">{value}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  dirty,
  onChange,
  onBlur
}: {
  label: string;
  value: string;
  dirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        className={`w-full rounded border px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60 ${
          dirty ? "border-accent/60 bg-accent/5" : "border-line bg-black/20"
        }`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  dirty,
  onChange,
  onBlur
}: {
  label: string;
  value: string;
  options: string[];
  dirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <select
        className={`w-full rounded border px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60 ${
          dirty ? "border-accent/60 bg-accent/5" : "border-line bg-black/20"
        }`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  step,
  dirty,
  onChange,
  onBlur
}: {
  label: string;
  value: string;
  min?: number;
  step?: number;
  dirty?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        className={`w-full rounded border px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60 ${
          dirty ? "border-accent/60 bg-accent/5" : "border-line bg-black/20"
        }`}
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <p className="-mt-2 text-xs text-warning">{message}</p>;
}

function ToggleField({
  label,
  checked,
  dirty,
  onChange,
  onBlur
}: {
  label: string;
  checked: boolean;
  dirty?: boolean;
  onChange: (checked: boolean) => void;
  onBlur?: () => void;
}) {
  return (
    <label
      className={`flex items-center justify-between rounded border px-2 py-2 text-slate-100 ${
        dirty ? "border-accent/60 bg-accent/5" : "border-line bg-black/20"
      }`}
    >
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        checked={checked}
        type="checkbox"
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
