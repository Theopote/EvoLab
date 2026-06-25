import type { AnthropicImageMediaType } from "@/lib/anthropic-types";
import type { PlanImportSource } from "@/lib/plan-import/types";
import { detectImportSource } from "@/lib/plan-import/detect-source";

export interface CopilotPinnedFile {
  id: string;
  fileName: string;
  base64: string;
  sourceType: PlanImportSource;
  mediaType?: AnthropicImageMediaType;
  previewUrl: string;
}

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const structuredExtensions = new Set(["pdf", "dxf"]);

const structuredPreviewSvg =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#102030"/><path d="M16 44 L32 20 L48 44 Z" fill="none" stroke="#5eead4" stroke-width="2"/><text x="32" y="54" text-anchor="middle" fill="#94a3b8" font-size="8" font-family="sans-serif">CAD</text></svg>`
  );

function inferImageMediaType(fileName: string): AnthropicImageMediaType | undefined {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return undefined;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

export function isImagePinnedFile(file: CopilotPinnedFile) {
  return file.sourceType === "image";
}

export async function readCopilotUpload(file: File): Promise<CopilotPinnedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const sourceType = detectImportSource(file.name);

  if (extension === "dwg") {
    throw new Error("DWG is not supported directly. Export the drawing as DXF or PDF first.");
  }

  if (!imageExtensions.has(extension) && !structuredExtensions.has(extension)) {
    throw new Error("Supported uploads: PNG, JPEG, GIF, WebP, PDF, or DXF.");
  }

  const base64 = await readFileAsBase64(file);

  if (sourceType === "image") {
    const dataUrl = await readFileAsDataUrl(file);
    const mediaType = inferImageMediaType(file.name);

    if (!mediaType) {
      throw new Error("Unsupported image type. Use PNG, JPEG, GIF, or WebP.");
    }

    return {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fileName: file.name,
      base64,
      sourceType,
      mediaType,
      previewUrl: dataUrl
    };
  }

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName: file.name,
    base64,
    sourceType,
    previewUrl: structuredPreviewSvg
  };
}
