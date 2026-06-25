"use client";

import { Camera, Copy, Lightbulb, Palette, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Scene } from "@/components/viewer-3d/Scene";
import type { PlanVersion } from "@/lib/project-types";

const materialStyles = ["White clay", "Warm timber", "Clinical clean", "Glass and metal", "Concrete shell"];
const lightingSetups = ["North daylight", "Overcast studio", "Golden hour", "Night interior", "Atrium skylight"];
const cameraViews = ["Aerial axonometric", "Entrance eye-level", "Medical street", "Core perspective", "South facade"];
const renderPurposes = ["Concept board", "Client review", "Planning report", "Design critique", "AI image brief"];

interface RenderBriefPanelProps {
  activeVersion?: PlanVersion;
  layout?: "split" | "compact";
}

export function RenderBriefPanel({ activeVersion, layout = "split" }: RenderBriefPanelProps) {
  const [materialStyle, setMaterialStyle] = useState(materialStyles[0]);
  const [lighting, setLighting] = useState(lightingSetups[0]);
  const [cameraView, setCameraView] = useState(cameraViews[0]);
  const [purpose, setPurpose] = useState(renderPurposes[0]);
  const [notes, setNotes] = useState(
    "Professional architectural visualization, restrained BIM/CAD design language, readable massing and clear spatial hierarchy."
  );
  const [copied, setCopied] = useState(false);

  const renderBrief = useMemo(() => {
    if (!activeVersion) {
      return "No active version selected.";
    }

    const roomSummary = activeVersion.rooms
      .map((room) => `${room.name}: ${room.type}, ${room.areaSqm} sqm`)
      .join("; ");

    return [
      `Project: ${activeVersion.label}`,
      `Source: editable EvoLab PlanVersion with ${activeVersion.rooms.length} rooms.`,
      `Material style: ${materialStyle}.`,
      `Lighting: ${lighting}.`,
      `Camera: ${cameraView}.`,
      `Purpose: ${purpose}.`,
      `Rooms: ${roomSummary}.`,
      `Notes: ${notes}`
    ].join("\n");
  }, [activeVersion, cameraView, lighting, materialStyle, notes, purpose]);

  async function copyBrief() {
    await navigator.clipboard.writeText(renderBrief);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  const controls = (
    <div className="space-y-3">
      <SelectControl icon={Palette} label="Material style" value={materialStyle} options={materialStyles} onChange={setMaterialStyle} />
      <SelectControl icon={Lightbulb} label="Lighting" value={lighting} options={lightingSetups} onChange={setLighting} />
      <SelectControl icon={Camera} label="Camera view" value={cameraView} options={cameraViews} onChange={setCameraView} />
      <SelectControl icon={Sparkles} label="Purpose" value={purpose} options={renderPurposes} onChange={setPurpose} />

      <label className="grid gap-1 text-xs text-muted">
        Render notes
        <textarea
          className="min-h-24 resize-none rounded border border-line bg-[#0b1118] p-2 text-sm leading-5 text-slate-100 outline-none focus:border-accent/70"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      <div className="rounded border border-line bg-[#0b1118] p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">External render brief</h2>
          <button
            className="flex h-8 items-center gap-2 rounded border border-line px-2 text-xs text-slate-200 hover:border-accent/60 hover:text-accent"
            type="button"
            onClick={copyBrief}
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="max-h-64 whitespace-pre-wrap rounded bg-black/20 p-2 text-xs leading-5 text-muted">{renderBrief}</pre>
      </div>
    </div>
  );

  if (layout === "compact") {
    return (
      <section className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-white">Visual render brief</h2>
          <p className="mt-1 text-xs text-muted">Copy a linked brief for external AI image or visualization tools.</p>
        </div>
        {controls}
      </section>
    );
  }

  return (
    <section className="grid min-h-full grid-cols-[360px_minmax(0,1fr)] gap-4">
      <aside className="rounded border border-line bg-panel/90 p-3">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-white">Visual render brief</h2>
          <p className="mt-1 text-xs text-muted">Linked to the active model for external visualization workflows.</p>
        </div>
        {controls}
      </aside>

      <section className="grid min-h-full grid-rows-[auto_minmax(560px,1fr)] gap-4">
        <div className="rounded border border-line bg-panel/90 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Preview model</h3>
              <p className="mt-1 text-xs text-muted">Same activeVersion geometry as Massing and presentation captures.</p>
            </div>
            <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">
              {activeVersion?.label ?? "No active version"}
            </span>
          </div>
        </div>
        <Scene />
      </section>
    </section>
  );
}

function SelectControl({
  icon: Icon,
  label,
  value,
  options,
  onChange
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent" />
        {label}
      </span>
      <select
        className="h-9 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
