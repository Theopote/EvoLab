import type { PresentationDeck, PresentationSlide } from "@/lib/presentation/types";

export type PresentationSlidePatch = Partial<Pick<PresentationSlide, "title" | "subtitle" | "bullets">>;

export type PresentationDeckMetaPatch = Partial<Pick<PresentationDeck, "storyArc" | "designNarrative">>;

export function updateSlideInDeck(
  deck: PresentationDeck,
  slideId: string,
  patch: PresentationSlidePatch
): PresentationDeck {
  return {
    ...deck,
    slides: deck.slides.map((slide) =>
      slide.id === slideId
        ? {
            ...slide,
            ...patch,
            bullets: patch.bullets ?? slide.bullets
          }
        : slide
    )
  };
}

export function updateDeckMeta(deck: PresentationDeck, patch: PresentationDeckMetaPatch): PresentationDeck {
  return {
    ...deck,
    ...patch
  };
}

export function removeSlideFromDeck(deck: PresentationDeck, slideId: string): PresentationDeck {
  if (deck.slides.length <= 1) {
    return deck;
  }

  return {
    ...deck,
    slides: deck.slides.filter((slide) => slide.id !== slideId)
  };
}

export function moveSlideInDeck(deck: PresentationDeck, fromIndex: number, toIndex: number): PresentationDeck {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= deck.slides.length) {
    return deck;
  }

  const slides = [...deck.slides];
  const [moved] = slides.splice(fromIndex, 1);

  if (!moved) {
    return deck;
  }

  const clampedTarget = Math.max(0, Math.min(toIndex, slides.length));
  slides.splice(clampedTarget, 0, moved);

  return {
    ...deck,
    slides
  };
}

export function bulletsFromMultilineText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function multilineTextFromBullets(bullets: string[]): string {
  return bullets.join("\n");
}
