import type { AnthropicImageMediaType } from "@/lib/anthropic-tool";

export interface CopilotPinnedFile {
  id: string;
  fileName: string;
  base64: string;
  mediaType: AnthropicImageMediaType;
  previewUrl: string;
}

const imageExtensions = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);

function inferMediaType(fileName: string): AnthropicImageMediaType | undefined {
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

export async function readCopilotUpload(file: File): Promise<CopilotPinnedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!imageExtensions.has(extension)) {
    throw new Error("Only PNG, JPEG, GIF, WebP, or SVG reference drawings are supported.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const mediaType = inferMediaType(file.name);

  if (!mediaType) {
    throw new Error("SVG and PDF references must be exported as PNG or JPEG before upload.");
  }

  const base64 = dataUrl.replace(/^data:image\/[a-z+]+;base64,/i, "");

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName: file.name,
    base64,
    mediaType,
    previewUrl: dataUrl
  };
}
