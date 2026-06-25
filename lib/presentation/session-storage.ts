import type { PresentationSessionMap } from "@/lib/presentation/session-types";

const STORAGE_KEY = "evolab.presentation.sessions";

export function readPresentationSessions(): PresentationSessionMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as PresentationSessionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writePresentationSessions(sessions: PresentationSessionMap) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Session storage quota can be exceeded when decks include large capture images.
  }
}
