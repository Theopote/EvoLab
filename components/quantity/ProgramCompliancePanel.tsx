"use client";

import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { useMemo } from "react";
import type { ProgramModel } from "@/lib/building-domain";
import { validateVersionAgainstProgram } from "@/lib/program-validation";
import type { PlanVersion } from "@/lib/project-types";

interface ProgramCompliancePanelProps {
  program: ProgramModel;
  activeVersion?: PlanVersion;
}

export function ProgramCompliancePanel({ program, activeVersion }: ProgramCompliancePanelProps) {
  const validation = useMemo(
    () => (activeVersion ? validateVersionAgainstProgram(activeVersion, program) : undefined),
    [activeVersion, program]
  );

  const requiredSpaces = program.spaces.filter((space) => space.priority === "required");
  const warningCount = validation?.issues.filter((issue) => issue.severity === "warning").length ?? 0;
  const errorCount = validation?.issues.filter((issue) => issue.severity === "error").length ?? 0;

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ClipboardList className="h-4 w-4 text-accent" />
            Program Compliance
          </h2>
          <p className="mt-1 text-xs text-muted">
            {program.label} · {requiredSpaces.length} required spaces
          </p>
        </div>
        {validation ? (
          <span
            className={`rounded border px-2 py-1 text-[11px] ${
              validation.valid ? "border-success/40 text-success" : "border-warning/40 text-warning"
            }`}
          >
            {validation.valid ? "Compliant" : `${errorCount} errors`}
          </span>
        ) : null}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Spaces" value={String(program.spaces.length)} />
        <Metric label="Target GFA" value={`${program.targetGrossAreaSqm ?? "—"} sqm`} />
        <Metric label="Warnings" value={String(warningCount)} tone={warningCount > 0 ? "warning" : "default"} />
        <Metric label="Errors" value={String(errorCount)} tone={errorCount > 0 ? "warning" : "default"} />
      </div>

      <div className="space-y-2">
        {program.spaces.slice(0, 8).map((space) => {
          const issue = validation?.issues.find((item) => item.spaceId === space.id);
          const matchedRooms =
            activeVersion?.rooms.filter(
              (room) => room.id === space.id || room.type === space.roomType || room.name === space.name
            ).length ?? 0;

          return (
            <div className="rounded border border-line bg-[#0b1118] p-2 text-xs" key={space.id}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-100">{space.name}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-muted">{space.priority}</span>
              </div>
              <div className="mt-1 text-muted">
                {space.roomType} · target {space.targetAreaSqm ?? "—"} sqm · matched {matchedRooms}
              </div>
              {issue ? (
                <div className="mt-1 flex items-start gap-1 text-warning">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>{issue.message}</span>
                </div>
              ) : matchedRooms > 0 ? (
                <div className="mt-1 flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Matched in active scheme</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {validation?.issues.length ? (
        <div className="mt-3 rounded border border-line bg-white/[0.03] p-2">
          <div className="mb-2 text-[11px] uppercase tracking-[0.12em] text-muted">Open issues</div>
          <div className="space-y-2">
            {validation.issues.slice(0, 6).map((issue) => (
              <div className="text-xs text-slate-200" key={`${issue.id}-${issue.message}`}>
                {issue.message}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-1 ${tone === "warning" ? "text-warning" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
