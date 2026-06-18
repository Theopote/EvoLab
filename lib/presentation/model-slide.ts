import type { PresentationCaptureImage } from "@/lib/presentation-capture-store";
import type { PresentationDeck, PresentationSlide } from "@/lib/presentation/types";

export const MODEL_SLIDE_ID = "slide-model-3d";

export function createModelSlidePlaceholder(): PresentationSlide {
  return {
    id: MODEL_SLIDE_ID,
    kind: "massing",
    title: "3D Model Views",
    subtitle: "Live WebGL captures",
    bullets: [
      "Use Capture 3D views to embed isometric, eye-level, plan, and exploded WebGL renders.",
      "Captures include site envelope and surrounding context when available."
    ]
  };
}

export function fillModelSlide(images: PresentationCaptureImage[]): PresentationSlide {
  return {
    id: MODEL_SLIDE_ID,
    kind: "massing",
    title: "3D Model Views",
    subtitle: "Captured from live WebGL scene",
    bullets: images.map((image) => `${image.label} rendering embedded from activeVersion geometry.`),
    images
  };
}

export function upsertModelCaptures(deck: PresentationDeck, images: PresentationCaptureImage[]): PresentationDeck {
  if (images.length === 0) {
    return deck;
  }

  const filled = fillModelSlide(images);
  const existingIndex = deck.slides.findIndex((slide) => slide.id === MODEL_SLIDE_ID);

  if (existingIndex >= 0) {
    return {
      ...deck,
      slides: deck.slides.map((slide, index) => (index === existingIndex ? filled : slide))
    };
  }

  const massingIndex = deck.slides.findIndex((slide) => slide.id === "slide-massing");
  const slides =
    massingIndex >= 0
      ? [...deck.slides.slice(0, massingIndex + 1), filled, ...deck.slides.slice(massingIndex + 1)]
      : [...deck.slides, filled];

  return { ...deck, slides };
}

export function extractModelCaptures(deck?: PresentationDeck) {
  return deck?.slides.find((slide) => slide.id === MODEL_SLIDE_ID)?.images ?? [];
}
