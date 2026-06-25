import type { PresentationDeck, PresentationTemplateId } from "@/lib/presentation/types";

export interface PresentationSession {
  versionId: string;
  deck: PresentationDeck;
  templateId: PresentationTemplateId;
  activeSlideIndex: number;
  updatedAt: string;
}

export type PresentationSessionMap = Record<string, PresentationSession>;
