export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;

export function decodeBase64File(base64?: string): Buffer | undefined {
  if (!base64?.trim()) {
    return undefined;
  }

  const trimmed = base64.trim();
  const dataUrlMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
  const payload = (dataUrlMatch?.[1] ?? trimmed).replace(/\s/g, "");

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error("fileBase64 is not valid base64 data.");
  }

  const buffer = Buffer.from(payload, "base64");

  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error("Uploaded file is too large. Limit imports to 12 MB.");
  }

  return buffer;
}
