export async function fetchPdfPageInfo(fileBase64: string) {
  const response = await fetch("/api/pdf-page-info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64 })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `pdf-page-info failed with ${response.status}`);
  }

  const data = (await response.json()) as { numPages?: number };

  if (!data.numPages || data.numPages < 1) {
    throw new Error("pdf-page-info did not return a valid page count.");
  }

  return { numPages: data.numPages };
}
