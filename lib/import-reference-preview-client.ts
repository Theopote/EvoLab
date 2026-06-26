import { readApiResponse } from "@/lib/api-client";

export async function fetchPdfImportReferencePreview(fileBase64: string, pageNumber = 1) {
  const response = await fetch("/api/import-reference-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, sourceType: "pdf", pageNumber })
  });

  const data = await readApiResponse<{ previewUrl?: string }>(response);

  if (!data.previewUrl) {
    throw new Error("import-reference-preview did not return a previewUrl.");
  }

  return data.previewUrl;
}
