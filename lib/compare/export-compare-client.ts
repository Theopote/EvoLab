import { readApiBlob } from "@/lib/api-client";
import type { CompareReport } from "@/lib/compare/compare-report-types";

export async function downloadCompareReportPdfViaApi(report: CompareReport) {
  const response = await fetch("/api/export-compare-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report })
  });

  const blob = await readApiBlob(response);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.projectName.replace(/\s+/g, "-").toLowerCase()}-compare-report.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
