import { readApiResponse } from "@/lib/api-client";

export async function fetchPdfPageInfo(fileBase64: string) {
  const response = await fetch("/api/pdf-page-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64 })
  });

  const data = await readApiResponse<{ numPages?: number }>(response);

  if (!data.numPages || data.numPages < 1) {
    throw new Error("pdf-page-info did not return a valid page count.");
  }

  return { numPages: data.numPages };
}
