import { produce } from "immer";
import type { PresentationDeck, PresentationTemplateId } from "@/lib/presentation/types";
import { readPresentationSessions, writePresentationSessions } from "@/lib/presentation/session-storage";
import type { PresentationSession, PresentationSessionMap } from "@/lib/presentation/session-types";
import type { EvoProjectStore } from "@/lib/store/types";
import type { StateCreator } from "zustand";

function persistSessions(sessions: PresentationSessionMap) {
  writePresentationSessions(sessions);
}

export const createPresentationSlice: StateCreator<
  EvoProjectStore,
  [],
  [],
  Pick<
    EvoProjectStore,
    | "presentationSessions"
    | "savePresentationSession"
    | "clearPresentationSession"
    | "setPresentationActiveSlide"
    | "setPresentationTemplateId"
  >
> = (set) => ({
  presentationSessions: readPresentationSessions(),

  savePresentationSession: (versionId, patch) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.presentationSessions[versionId];
        const deck = patch.deck ?? current?.deck;

        if (!deck) {
          return;
        }

        state.presentationSessions[versionId] = {
          versionId,
          deck,
          templateId: patch.templateId ?? current?.templateId ?? "classic",
          activeSlideIndex: patch.activeSlideIndex ?? current?.activeSlideIndex ?? 0,
          updatedAt: new Date().toISOString()
        };
        persistSessions(state.presentationSessions);
      })
    ),

  clearPresentationSession: (versionId) =>
    set(
      produce<EvoProjectStore>((state) => {
        delete state.presentationSessions[versionId];
        persistSessions(state.presentationSessions);
      })
    ),

  setPresentationActiveSlide: (versionId, activeSlideIndex) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.presentationSessions[versionId];
        if (!current) {
          return;
        }

        state.presentationSessions[versionId] = {
          ...current,
          activeSlideIndex,
          updatedAt: new Date().toISOString()
        };
        persistSessions(state.presentationSessions);
      })
    ),

  setPresentationTemplateId: (versionId, templateId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const current = state.presentationSessions[versionId];
        if (!current) {
          return;
        }

        state.presentationSessions[versionId] = {
          ...current,
          templateId,
          deck: { ...current.deck, templateId },
          updatedAt: new Date().toISOString()
        };
        persistSessions(state.presentationSessions);
      })
    )
});

export function getPresentationSession(
  sessions: PresentationSessionMap,
  versionId?: string
): PresentationSession | undefined {
  if (!versionId) {
    return undefined;
  }

  return sessions[versionId];
}

export function mergePresentationDeck(
  session: PresentationSession | undefined,
  localDeck: PresentationDeck | undefined,
  templateId: PresentationTemplateId
): PresentationDeck | undefined {
  const deck = session?.deck ?? localDeck;
  if (!deck) {
    return undefined;
  }

  return {
    ...deck,
    templateId: session?.templateId ?? templateId
  };
}
