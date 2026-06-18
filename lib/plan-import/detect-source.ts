import type { PlanImportSource } from "@/lib/plan-import/types";

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const structuredExtensions: Record<string, PlanImportSource> = {
  pdf: "pdf",
  dxf: "dxf"
};

export function detectImportSource(fileName?: string, explicit?: PlanImportSource): PlanImportSource {
  if (explicit) {
    return explicit;
  }

  const extension = fileName?.split(".").pop()?.toLowerCase() ?? "";

  if (structuredExtensions[extension]) {
    return structuredExtensions[extension];
  }

  if (imageExtensions.has(extension)) {
    return "image";
  }

  return "image";
}

export function isStructuredImportSource(source: PlanImportSource) {
  return source === "pdf" || source === "dxf";
}
