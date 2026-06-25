export type AnthropicImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface AnthropicToolImageInput {
  base64: string;
  mediaType: AnthropicImageMediaType;
}
