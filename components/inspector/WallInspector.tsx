"use client";

import { useState } from "react";
import { wallLength } from "@/components/floor-plan/floor-plan-utils";
import { useSelectionState } from "@/lib/project-store";

export function WallInspector() {
  const selectedWall = useSelectionState((state) => state.selectedWall);
  const [copied, setCopied] = useState<string | null>(null);

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

      <dl className="space-y-3 text-sm">
        <Info label="id" value={selectedWall.id} canCopy copied={copied === "id"} onCopy={() => copyValue("id", selectedWall.id)} />
        <Info label="type" value={selectedWall.type} />
        <Info label="thickness" value={`${selectedWall.thickness.toFixed(2)} m`} />
        <Info label="height" value={`${selectedWall.height.toFixed(2)} m`} />
        <Info label="length" value={`${wallLength(selectedWall).toFixed(2)} m`} />
        <Info
          label="roomIds"
          value={selectedWall.roomIds.join(", ") || "-"}
          canCopy
          copied={copied === "roomIds"}
          onCopy={() => copyValue("roomIds", selectedWall.roomIds.join(", "))}
        />
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
