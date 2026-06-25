import type { CompareReport } from "@/lib/compare/compare-report-types";

export async function downloadCompareReportPdfViaApi(report: CompareReport) {
  const response = await fetch("/api/export-compare-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report })
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `export-compare-pdf failed with ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.projectName.replace(/\s+/g, "-").toLowerCase()}-compare-report.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
