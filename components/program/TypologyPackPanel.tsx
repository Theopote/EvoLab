"use client";

import { listTypologyPacks } from "@/lib/typologies";
import { resolveTypologyPackId } from "@/lib/typology/resolve";
import type { TypologyPackId } from "@/lib/typology/types";
import { useProjectActions, useProjectState } from "@/lib/project-store";

interface TypologyPackPanelProps {
  variant?: "default" | "embedded";
  showBriefPreview?: boolean;
}

export function TypologyPackPanel({
  variant = "default",
  showBriefPreview = true
}: TypologyPackPanelProps) {
  const projectType = useProjectState((state) => state.project.projectType);
  const brief = useProjectState((state) => state.brief);
  const codeLabel = useProjectState((state) => state.project.domain.codeContext.label);
  const { setProjectTypology } = useProjectActions();
  const activePackId = resolveTypologyPackId(projectType);
  const packs = listTypologyPacks();
  const embedded = variant === "embedded";

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <h3 className={`font-semibold text-white ${embedded ? "mb-1 text-sm" : "mb-2 text-sm"}`}>
        Typology pack
      </h3>
      {!embedded ? (
        <p className="mb-3 text-xs text-muted">
          Switches code context, scoring presets, program language, schedules, and copilot supplements.
        </p>
      ) : (
        <p className="mb-3 text-xs text-muted">
          Code package: <span className="text-slate-200">{codeLabel}</span>
        </p>
      )}
      <div className="grid gap-2">
        {packs.map((pack) => {
          const selected = pack.id === activePackId;

          return (
            <button
              key={pack.id}
              className={`rounded border px-3 py-2 text-left text-sm transition ${
                selected
                  ? "border-accent bg-accent/10 text-white"
                  : "border-line bg-[#0b1118] text-slate-200 hover:border-accent/50"
              }`}
              type="button"
              onClick={() => setProjectTypology(pack.id as TypologyPackId)}
            >
              <div className="font-medium">{pack.label}</div>
              <div className="mt-1 text-xs text-muted">{pack.id}</div>
            </button>
          );
        })}
      </div>
      {showBriefPreview ? (
        <dl className="mt-4 space-y-2 text-xs text-muted">
          <div>
            <dt className="uppercase tracking-wide">Brief</dt>
            <dd className="mt-1 text-slate-200">{brief.description || "No description"}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide">Code package</dt>
            <dd className="mt-1 text-slate-200">{codeLabel}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
