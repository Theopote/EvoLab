export const MAX_IMPORT_BYTES = 12 * 1024 * 1024;
// Max base64 string length (base64 is ~33% larger than binary, plus data URL overhead)
const MAX_BASE64_LENGTH = Math.ceil((MAX_IMPORT_BYTES * 4) / 3) + 1024;

export function decodeBase64File(base64?: string): Buffer | undefined {
  if (!base64?.trim()) {
    return undefined;
  }

  const trimmed = base64.trim();

  // Validate string length before processing to prevent memory exhaustion
  if (trimmed.length > MAX_BASE64_LENGTH) {
    throw new Error("Base64 string is too large. Limit imports to 12 MB.");
  }

  const dataUrlMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
  const payload = (dataUrlMatch?.[1] ?? trimmed).replace(/\s/g, "");

  // Validate base64 format
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error("fileBase64 is not valid base64 data.");
  }

  const buffer = Buffer.from(payload, "base64");

  // Validate decoded size
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error("Uploaded file is too large. Limit imports to 12 MB.");
  }

  return buffer;
}
