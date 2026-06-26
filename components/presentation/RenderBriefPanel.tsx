"use client";

import { Camera, Copy, Lightbulb, Palette, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Scene } from "@/components/viewer-3d/Scene";
import type { DesignBrief, PlanVersion } from "@/lib/project-types";
import { buildRenderBrief, buildStructuredRenderPrompt } from "@/lib/presentation/render-prompt";

const materialStyles = ["White clay", "Warm timber", "Clinical clean", "Glass and metal", "Concrete shell"];
const lightingSetups = ["North daylight", "Overcast studio", "Golden hour", "Night interior", "Atrium skylight"];
const cameraViews = ["Aerial axonometric", "Entrance eye-level", "Medical street", "Core perspective", "South facade"];
const renderPurposes = ["Concept board", "Client review", "Planning report", "Design critique", "AI image brief"];

interface RenderBriefPanelProps {
  activeVersion?: PlanVersion;
  projectType?: string;
  brief?: DesignBrief;
  layout?: "split" | "compact";
}

export function RenderBriefPanel({
  activeVersion,
  projectType,
  brief,
  layout = "split"
}: RenderBriefPanelProps) {
  const [materialStyle, setMaterialStyle] = useState(materialStyles[0]);
  const [lighting, setLighting] = useState(lightingSetups[0]);
  const [cameraView, setCameraView] = useState(cameraViews[0]);
  const [purpose, setPurpose] = useState(renderPurposes[0]);
  const [notes, setNotes] = useState(
    "Professional architectural visualization, restrained BIM/CAD design language, readable massing and clear spatial hierarchy."
  );
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const promptOptions = useMemo(
    () => ({
      materialStyle,
      lighting,
      cameraView,
      purpose,
      notes,
      projectType,
      brief
    }),
    [brief, cameraView, lighting, materialStyle, notes, projectType, purpose]
  );

  const renderBrief = useMemo(() => {
    if (!activeVersion) {
      return "No active version selected.";
    }

    return buildRenderBrief(activeVersion, promptOptions);
  }, [activeVersion, promptOptions]);

  const structuredPrompt = useMemo(() => {
    if (!activeVersion) {
      return null;
    }

    return buildStructuredRenderPrompt(activeVersion, promptOptions);
  }, [activeVersion, promptOptions]);

  async function copyBrief() {
    await navigator.clipboard.writeText(renderBrief);
    setCopiedBrief(true);
    window.setTimeout(() => setCopiedBrief(false), 1400);
  }

  async function copyStructuredPrompt() {
    if (!structuredPrompt) {
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(structuredPrompt, null, 2));
    setCopiedJson(true);
    window.setTimeout(() => setCopiedJson(false), 1400);
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-white">External render brief</h2>
          <div className="flex items-center gap-2">
            <button
              className="flex h-8 items-center gap-2 rounded border border-line px-2 text-xs text-slate-200 hover:border-accent/60 hover:text-accent"
              type="button"
              onClick={copyStructuredPrompt}
              disabled={!structuredPrompt}
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedJson ? "Copied JSON" : "Copy JSON"}
            </button>
            <button
              className="flex h-8 items-center gap-2 rounded border border-line px-2 text-xs text-slate-200 hover:border-accent/60 hover:text-accent"
              type="button"
              onClick={copyBrief}
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedBrief ? "Copied" : "Copy brief"}
            </button>
          </div>
        </div>
        <pre className="max-h-64 whitespace-pre-wrap rounded bg-black/20 p-2 text-xs leading-5 text-muted">{renderBrief}</pre>
      </div>

      {structuredPrompt ? (
        <div className="rounded border border-line bg-[#0b1118] p-3">
          <h3 className="text-sm font-medium text-white">SD / DALL-E prompt</h3>
          <p className="mt-1 text-xs text-muted">
            Data-driven positive prompt from activeVersion. Pair with a depth or line capture from the preview for ControlNet.
          </p>
          <pre className="mt-2 max-h-32 whitespace-pre-wrap rounded bg-black/20 p-2 text-xs leading-5 text-muted">
            {structuredPrompt.positive_prompt}
          </pre>
        </div>
      ) : null}
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
          <p className="mt-1 text-xs text-muted">
            Linked to the active model for external visualization workflows. Right-drag to pan, scroll to zoom.
          </p>
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
