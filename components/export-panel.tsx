"use client";

import { readApiBlob } from "@/lib/api-client";
import { Download, FileArchive, FileCode2, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { buildComplianceReport, type ComplianceItem, type QuantityResult } from "@/lib/quantity-engine";
import { complianceReportToMarkdown } from "@/lib/compliance/compliance-report";
import {
  createComplianceCsv,
  createPlanSvg,
  createQuantityCsv,
  downloadTextFile,
  exportDxfDocument,
  exportIfcHandoffJson,
  exportProjectJson,
  exportVersionJson
} from "@/lib/export-utils";
import { openPlanPdfPrint } from "@/lib/export-plan-pdf";
import { downloadGltfModel } from "@/lib/export-gltf";
import type { PlanVersion, ProjectData } from "@/lib/project-types";

interface ExportPanelProps {
  project: ProjectData;
  activeVersion?: PlanVersion;
  quantities?: QuantityResult;
  complianceItems: ComplianceItem[];
}

const plannedExports = [{ label: "IFC STEP file", detail: "Needs IfcOpenShell service", icon: FileCode2 }];

export function ExportPanel({ project, activeVersion, quantities, complianceItems }: ExportPanelProps) {
  const canExportVersion = Boolean(activeVersion);
  const canExportQuantities = Boolean(quantities);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingGltf, setIsExportingGltf] = useState(false);

  function handlePlanPdfExport() {
    if (!activeVersion) {
      return;
    }

    try {
      openPlanPdfPrint(activeVersion);
      setExportNotice("Opened print dialog for the active plan sheet.");
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : "Failed to open plan PDF print.");
    }
  }

  async function handleServerPlanPdfExport() {
    if (!activeVersion) {
      return;
    }

    setIsExportingPdf(true);
    setExportNotice(null);

    try {
      const response = await fetch("/api/export-plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: activeVersion })
      });

      const blob = await readApiBlob(response);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeVersion.id}-plan.pdf`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setExportNotice("Server PDF downloaded.");
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : "Server PDF export failed.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  async function handleGltfExport() {
    if (!activeVersion) {
      return;
    }

    setIsExportingGltf(true);
    setExportNotice(null);

    try {
      await downloadGltfModel(activeVersion);
      setExportNotice("glTF binary (.glb) downloaded.");
    } catch (error) {
      setExportNotice(error instanceof Error ? error.message : "glTF export failed.");
    } finally {
      setIsExportingGltf(false);
    }
  }

  return (
    <section className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="rounded border border-line bg-panel/90 p-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Export Center</h1>
            <p className="mt-1 text-xs text-muted">
              Export editable semantic data first; drawings and model formats stay tied to activeVersion.
            </p>
          </div>
          <span className="rounded border border-accent/40 px-2 py-1 text-xs text-accent">
            {activeVersion?.label ?? "No active version"}
          </span>
        </div>
      </div>

      {exportNotice ? (
        <div className="rounded border border-accent/30 bg-accent/10 p-2 text-xs text-accent">{exportNotice}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <section className="rounded border border-line bg-panel/90 p-3">
          <h2 className="mb-3 text-sm font-semibold text-white">Presentation Export</h2>
          <p className="mb-3 text-xs text-muted">
            For full storyboard decks with isometric diagrams and AI narrative, use the Presentation workspace.
          </p>
          <h2 className="mb-3 text-sm font-semibold text-white">Available Exports</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <ExportCard
              icon={FileJson}
              label="ProjectData JSON"
              detail={`${project.versions.length} versions, active: ${project.activeVersionId}`}
              onClick={() => exportProjectJson(project)}
            />
            <ExportCard
              disabled={!canExportVersion}
              icon={FileJson}
              label="Active PlanVersion JSON"
              detail={activeVersion ? `${activeVersion.rooms.length} rooms` : "No active version"}
              onClick={() => activeVersion && exportVersionJson(activeVersion)}
            />
            <ExportCard
              disabled={!canExportVersion}
              icon={FileText}
              label="Drawing PDF"
              detail="Browser print-to-PDF for the active floor plan"
              onClick={handlePlanPdfExport}
            />
            <ExportCard
              disabled={!canExportVersion || isExportingPdf}
              icon={FileText}
              label="Server PDF"
              detail="Playwright-rendered plan sheet download"
              onClick={() => void handleServerPlanPdfExport()}
            />
            <ExportCard
              disabled={!canExportVersion || isExportingGltf}
              icon={FileArchive}
              label="glTF model (.glb)"
              detail="Serialized room masses, walls and openings"
              onClick={() => void handleGltfExport()}
            />
            <ExportCard
              disabled={!canExportVersion}
              icon={FileCode2}
              label="Active plan SVG"
              detail="Editable vector floor plan"
              onClick={() =>
                activeVersion &&
                downloadTextFile(`${activeVersion.id}-plan.svg`, createPlanSvg(activeVersion), "image/svg+xml")
              }
            />
            <ExportCard
              disabled={!canExportQuantities}
              icon={FileSpreadsheet}
              label="Quantity CSV"
              detail={quantities ? `${quantities.rows.length} rows` : "No quantity result"}
              onClick={() =>
                quantities &&
                downloadTextFile(`${project.projectId}-quantities.csv`, createQuantityCsv(quantities), "text/csv")
              }
            />
            <ExportCard
              disabled={complianceItems.length === 0}
              icon={FileSpreadsheet}
              label="Compliance CSV"
              detail={`${complianceItems.filter((item) => item.status === "warning").length} warnings`}
              onClick={() =>
                downloadTextFile(
                  `${project.projectId}-compliance.csv`,
                  createComplianceCsv(complianceItems),
                  "text/csv"
                )
              }
            />
            <ExportCard
              disabled={!activeVersion || complianceItems.length === 0}
              icon={FileText}
              label="Compliance report"
              detail="Markdown with clause refs & recommendations"
              onClick={() => {
                if (!activeVersion) {
                  return;
                }

                const report = buildComplianceReport(activeVersion, { buildingType: project.projectType });
                downloadTextFile(
                  `${project.projectId}-compliance-report.md`,
                  complianceReportToMarkdown(report),
                  "text/markdown"
                );
              }}
            />
            <ExportCard
              disabled={!canExportVersion}
              icon={FileCode2}
              label="IFC handoff JSON"
              detail="IfcOpenShell service payload"
              onClick={() => activeVersion && exportIfcHandoffJson(activeVersion)}
            />
            <ExportCard
              disabled={!canExportVersion}
              icon={FileCode2}
              label="Authoritative walls DXF"
              detail="LINE entities from Level.walls when authoritative"
              onClick={() => activeVersion && exportDxfDocument(activeVersion)}
            />
          </div>
        </section>

        <section className="rounded border border-line bg-panel/90 p-3">
          <h2 className="mb-3 text-sm font-semibold text-white">Planned Model / Drawing Exports</h2>
          <div className="space-y-3">
            {plannedExports.map((item) => {
              const Icon = item.icon;
              return (
                <div className="rounded border border-line bg-[#0b1118] p-3 opacity-70" key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <Icon className="h-4 w-4 text-muted" />
                    <span className="rounded border border-line px-2 py-1 text-[11px] text-muted">Planned</span>
                  </div>
                  <div className="text-sm text-slate-200">{item.label}</div>
                  <div className="mt-1 text-xs text-muted">{item.detail}</div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function ExportCard({
  disabled,
  icon: Icon,
  label,
  detail,
  onClick
}: {
  disabled?: boolean;
  icon: typeof Download;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded border border-line bg-[#0b1118] p-3 text-left hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between">
        <Icon className="h-4 w-4 text-accent" />
        <Download className="h-3.5 w-3.5 text-muted" />
      </div>
      <div className="text-sm font-medium text-slate-100">{label}</div>
      <div className="mt-1 text-xs text-muted">{detail}</div>
    </button>
  );
}
