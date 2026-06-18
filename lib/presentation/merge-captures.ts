import type { PresentationDeck } from "@/lib/presentation/types";
import type { PresentationCaptureImage } from "@/lib/presentation-capture-store";

export function attachModelCaptures(deck: PresentationDeck, images: PresentationCaptureImage[]): PresentationDeck {
  if (images.length === 0) {
    return deck;
  }

  const modelSlide = {
    id: "slide-model-3d",
    kind: "massing" as const,
    title: "3D Model Views",
    subtitle: "Captured from live WebGL scene",
    bullets: images.map((image) => `${image.label} rendering embedded from activeVersion geometry.`),
    images
  };

  const massingIndex = deck.slides.findIndex((slide) => slide.id === "slide-massing");
  const slides =
    massingIndex >= 0
      ? [...deck.slides.slice(0, massingIndex + 1), modelSlide, ...deck.slides.slice(massingIndex + 1)]
      : [...deck.slides, modelSlide];

  return {
    ...deck,
    slides
  };
}
