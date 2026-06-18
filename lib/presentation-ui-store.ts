import { create } from "zustand";

interface PresentationUiStore {
  focusSlideId?: string;
  requestFocusSlide: (slideId: string) => void;
  consumeFocusSlide: () => string | undefined;
}

export const usePresentationUiStore = create<PresentationUiStore>((set, get) => ({
  focusSlideId: undefined,
  requestFocusSlide: (slideId) => set({ focusSlideId: slideId }),
  consumeFocusSlide: () => {
    const slideId = get().focusSlideId;

    if (!slideId) {
      return undefined;
    }

    set({ focusSlideId: undefined });
    return slideId;
  }
}));
