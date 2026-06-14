"use client";

import { useEvoProject } from "@/lib/project-store";

export function OpeningInspector() {
  const { selectedOpening } = useEvoProject();

  if (!selectedOpening) {
    return null;
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <span className="rounded border border-accent/30 px-2 py-1 text-xs text-accent">Opening</span>
      </div>

      <dl className="space-y-3 text-sm">
        <Info label="id" value={selectedOpening.id} />
        <Info label="type" value={selectedOpening.type} />
        <Info label="wallId" value={selectedOpening.wallId} />
        <Info label="width" value={`${selectedOpening.width.toFixed(2)} m`} />
        <Info label="height" value={`${selectedOpening.height.toFixed(2)} m`} />
        <Info label="sillHeight" value={`${(selectedOpening.sillHeight ?? 0).toFixed(2)} m`} />
      </dl>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-all text-slate-100">{value}</dd>
    </div>
  );
}
