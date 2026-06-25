export async function fetchPdfImportReferencePreview(fileBase64: string, pageNumber = 1) {
  const response = await fetch("/api/import-reference-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, sourceType: "pdf", pageNumber })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `import-reference-preview failed with ${response.status}`);
  }

  const data = (await response.json()) as { previewUrl?: string };

  if (!data.previewUrl) {
    throw new Error("import-reference-preview did not return a previewUrl.");
  }

  return data.previewUrl;
}
