"use client";

import { useShallow } from "zustand/react/shallow";
import { useEvoProject } from "@/lib/project-store";

export function ProjectInspector() {
  const { project, activeVersion, quantities, complianceItems } = useEvoProject(
    useShallow((state) => ({
      project: state.project,
      activeVersion: state.activeVersion,
      quantities: state.quantities,
      complianceItems: state.complianceItems
    }))
  );

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Inspector</h2>
        <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">Project</span>
      </div>
      <dl className="space-y-3 text-sm">
        <Info label="Project type" value={project.projectType} />
        <Info label="Active scheme" value={activeVersion?.label ?? "None"} />
        <Info label="Rooms" value={String(activeVersion?.rooms.length ?? 0)} />
        <Info label="Area efficiency" value={String(activeVersion?.scores?.areaEfficiency ?? 0)} />
        <Info label="Flow score" value={String(activeVersion?.scores?.circulationScore ?? 0)} />
        <Info label="Daylight score" value={String(activeVersion?.scores?.daylightScore ?? 0)} />
        <Info label="MEP alignment" value={String(activeVersion?.scores?.mepAlignmentScore ?? 0)} />
        <Info label="MEP routes" value={String(activeVersion?.mep?.routes.length ?? 0)} />
        <Info label="MEP shafts" value={String(activeVersion?.mep?.shafts.length ?? 0)} />
        <Info label="Risk count" value={String(activeVersion?.scores?.riskCount ?? 0)} />
        <Info label="Gross area" value={`${quantities?.summary.grossArea ?? 0} sqm`} />
        <Info label="Wall area" value={`${quantities?.summary.wallArea ?? 0} sqm`} />
        <Info
          label="Compliance warnings"
          value={String(complianceItems.filter((item) => item.status === "warning").length)}
        />
      </dl>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-white/[0.03] p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-slate-100">{value}</dd>
    </div>
  );
}
