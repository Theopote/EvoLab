export type PresentationSlideKind =
  | "cover"
  | "site"
  | "massing"
  | "plan"
  | "zones"
  | "flow"
  | "analysis"
  | "quantities"
  | "narrative";

export interface PresentationTable {
  headers: string[];
  rows: string[][];
}

export interface PresentationSlide {
  id: string;
  kind: PresentationSlideKind;
  title: string;
  subtitle?: string;
  bullets: string[];
  svg?: string;
  table?: PresentationTable;
}

export interface PresentationDeck {
  projectName: string;
  projectType: string;
  versionLabel: string;
  generatedAt: string;
  slides: PresentationSlide[];
  designNarrative?: string[];
}

export interface StoryboardRequest {
  projectName: string;
  projectType: string;
  brief?: string;
  versionLabel: string;
  siteSummary?: string;
  envelopeSummary?: string;
  quantitySummary?: string;
  scoreSummary?: string;
}
