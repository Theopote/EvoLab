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
  const { selectedRoom, updateRoom } = useEvoProject();

  if (!selectedRoom) {
    return null;
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Room</span>
      </div>

      <div className="space-y-3 text-sm">
        <ReadOnlyField label="id" value={selectedRoom.id} />
        <TextField
          label="name"
          value={selectedRoom.name}
          onChange={(value) => updateRoom(selectedRoom.id, { name: value })}
        />
        <SelectField
          label="type"
          value={selectedRoom.type}
          options={roomTypes}
          onChange={(value) => updateRoom(selectedRoom.id, { type: value as RoomType })}
        />
        <SelectField
          label="zone"
          value={selectedRoom.zone}
          options={zones}
          onChange={(value) => updateRoom(selectedRoom.id, { zone: value as FunctionZone })}
        />
        <NumberField
          label="areaSqm"
          value={selectedRoom.areaSqm}
          step={0.1}
          min={0}
          onChange={(value) => updateRoom(selectedRoom.id, { areaSqm: value })}
        />
        <NumberField
          label="ceilingHeight"
          value={selectedRoom.ceilingHeight}
          step={0.1}
          min={2}
          onChange={(value) => updateRoom(selectedRoom.id, { ceilingHeight: value })}
        />
        <TextField
          label="orientation"
          value={selectedRoom.orientation ?? ""}
          onChange={(value) => updateRoom(selectedRoom.id, { orientation: value || undefined })}
        />
        <ToggleField
          label="needsDaylight"
          checked={Boolean(selectedRoom.needsDaylight)}
          onChange={(checked) => updateRoom(selectedRoom.id, { needsDaylight: checked })}
        />
        <ToggleField
          label="needsPlumbing"
          checked={Boolean(selectedRoom.needsPlumbing)}
          onChange={(checked) => updateRoom(selectedRoom.id, { needsPlumbing: checked })}
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
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        className="w-full rounded border border-line bg-black/20 px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <select
        className="w-full rounded border border-line bg-black/20 px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        className="w-full rounded border border-line bg-black/20 px-2 py-2 text-slate-100 outline-none transition focus:border-accent/60"
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);

          if (Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded border border-line bg-black/20 px-2 py-2 text-slate-100">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
