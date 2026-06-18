import type { GenerateStoryboardToolInput } from "@/lib/schemas/presentation-schema";
import type { PresentationDeck } from "@/lib/presentation/types";

export function applySlideCopy(deck: PresentationDeck, slideCopy: GenerateStoryboardToolInput["slideCopy"]): PresentationDeck {
  if (!slideCopy.length) {
    return deck;
  }

  const copyById = new Map(slideCopy.map((entry) => [entry.slideId, entry]));

  return {
    ...deck,
    slides: deck.slides.map((slide) => {
      const copy = copyById.get(slide.id);

      if (!copy) {
        return slide;
      }

      return {
        ...slide,
        title: copy.title ?? slide.title,
        subtitle: copy.subtitle ?? slide.subtitle,
        bullets: copy.bullets?.length ? copy.bullets : slide.bullets
      };
    })
  };
}
