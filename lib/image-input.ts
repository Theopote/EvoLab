import type { AnthropicImageMediaType } from "@/lib/anthropic-tool";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const mediaTypesByExtension: Record<string, AnthropicImageMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp"
};

export interface NormalizedImageInput {
  base64: string;
  mediaType: AnthropicImageMediaType;
  byteLength: number;
  fileName?: string;
}

function inferMediaType(fileName?: string): AnthropicImageMediaType | undefined {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return extension ? mediaTypesByExtension[extension] : undefined;
}

export function normalizeImageInput(imageBase64?: string, fileName?: string): NormalizedImageInput | undefined {
  if (!imageBase64) {
    return undefined;
  }

  const trimmed = imageBase64.trim();
  const dataUrlMatch = trimmed.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i);
  const mediaType =
    (dataUrlMatch?.[1]?.toLowerCase() as AnthropicImageMediaType | undefined) ?? inferMediaType(fileName);
  const base64 = (dataUrlMatch?.[2] ?? trimmed).replace(/\s/g, "");

  if (!mediaType) {
    throw new Error("Unsupported or missing image type. Use PNG, JPEG, GIF, or WebP.");
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("imageBase64 is not valid base64 image data.");
  }

  const byteLength = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

  if (byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is too large. Limit reference images to 8 MB.");
  }

  return { base64, mediaType, byteLength, fileName };
}

export function normalizeImageInputs(
  images?: Array<{ base64: string; mediaType?: string; fileName?: string }>
): NormalizedImageInput[] {
  if (!images?.length) {
    return [];
  }

  return images.map((image, index) => {
    const normalized = normalizeImageInput(image.base64, image.fileName);

    if (!normalized) {
      throw new Error(`Reference image ${index + 1} is empty or invalid.`);
    }

    return normalized;
  });
}
