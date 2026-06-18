import type { PresentationDeck } from "@/lib/presentation/types";
import type { PresentationCaptureImage } from "@/lib/presentation-capture-store";
import { upsertModelCaptures } from "@/lib/presentation/model-slide";

export function attachModelCaptures(deck: PresentationDeck, images: PresentationCaptureImage[]): PresentationDeck {
  return upsertModelCaptures(deck, images);
}
