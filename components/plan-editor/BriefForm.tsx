"use client";

import { Wand2 } from "lucide-react";
import type { DesignBrief } from "@/lib/project-types";

interface BriefFormProps {
  value: DesignBrief;
  onChange: (value: DesignBrief) => void;
}

const chips = [
  "hospital",
  "housing",
  "office",
  "school",
  "retail",
  "exhibition",
  "south daylight",
  "north core",
  "clear people flow",
  "clean/dirty separation",
  "centralized equipment"
];

export function BriefForm({ value, onChange }: BriefFormProps) {
  function update<K extends keyof DesignBrief>(key: K, nextValue: DesignBrief[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  function addChip(chip: string) {
    const nextDescription = value.description ? `${value.description}, ${chip}` : chip;
    update("description", nextDescription);
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-white">Design Brief</h2>
      </div>

      <div className="grid gap-3">
        <label className="grid gap-1 text-xs text-muted">
          Building type
          <select
            className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
            value={value.projectType}
            onChange={(event) => update("projectType", event.target.value)}
          >
            <option value="healthcare">Healthcare</option>
            <option value="housing">Housing</option>
            <option value="office">Office</option>
            <option value="education">Education</option>
            <option value="retail">Retail</option>
            <option value="exhibition">Exhibition</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted">
            Floors
            <input
              className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
              min={1}
              type="number"
              value={value.floors}
              onChange={(event) => update("floors", Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Target area
            <input
              className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
              min={100}
              step={50}
              type="number"
              value={value.targetArea}
              onChange={(event) => update("targetArea", Number(event.target.value))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs text-muted">
            Core
            <input
              className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
              value={value.corePreference}
              onChange={(event) => update("corePreference", event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted">
            Orientation
            <input
              className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
              value={value.orientationPreference}
              onChange={(event) => update("orientationPreference", event.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1 text-xs text-muted">
          Requirements
          <textarea
            className="min-h-24 resize-none rounded border border-line bg-[#0b1118] p-2 text-sm leading-5 text-slate-100 outline-none focus:border-accent/70"
            value={value.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              className="rounded border border-line px-2 py-1 text-xs text-muted hover:border-accent/60 hover:text-accent"
              key={chip}
              type="button"
              onClick={() => addChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
