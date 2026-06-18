"use client";

import { useState } from "react";
import { useEvoProject } from "@/lib/project-store";

export function OpeningInspector() {
  const selectedOpening = useEvoProject((state) => state.selectedOpening);
  const [copied, setCopied] = useState<string | null>(null);

  if (!selectedOpening) {
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
        <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Opening</span>
      </div>

      <dl className="space-y-3 text-sm">
        <Info
          label="id"
          value={selectedOpening.id}
          canCopy
          copied={copied === "id"}
          onCopy={() => copyValue("id", selectedOpening.id)}
        />
        <Info label="type" value={selectedOpening.type} />
        <Info
          label="wallId"
          value={selectedOpening.wallId}
          canCopy
          copied={copied === "wallId"}
          onCopy={() => copyValue("wallId", selectedOpening.wallId)}
        />
        <Info label="width" value={`${selectedOpening.width.toFixed(2)} m`} />
        <Info label="height" value={`${selectedOpening.height.toFixed(2)} m`} />
        <Info label="sillHeight" value={`${(selectedOpening.sillHeight ?? 0).toFixed(2)} m`} />
      </dl>
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
