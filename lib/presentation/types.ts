export type PresentationSlideKind =
  | "cover"
  | "site"
  | "evolution"
  | "massing"
  | "plan"
  | "zones"
  | "flow"
  | "analysis"
  | "quantities"
  | "cost"
  | "narrative";

export type PresentationTemplateId = "classic" | "studio";

export interface PresentationTable {
  headers: string[];
  rows: string[][];
}

export interface PresentationSlideImage {
  id: string;
  label: string;
  dataUrl: string;
}

export interface PresentationSlide {
  id: string;
  kind: PresentationSlideKind;
  title: string;
  subtitle?: string;
  bullets: string[];
  svg?: string;
  images?: PresentationSlideImage[];
  table?: PresentationTable;
}

export interface PresentationDeck {
  projectName: string;
  projectType: string;
  versionLabel: string;
  generatedAt: string;
  templateId?: PresentationTemplateId;
  storyArc?: string[];
  slides: PresentationSlide[];
  designNarrative?: string[];
}

export interface StoryboardSlideCatalogItem {
  slideId: string;
  kind: PresentationSlideKind;
  title: string;
  subtitle?: string;
}

export interface StoryboardRequest {
  projectName: string;
  projectType: string;
  brief?: string;
  versionLabel: string;
  siteSummary?: string;
  envelopeSummary?: string;
  quantitySummary?: string;
  costSummary?: string;
  scoreSummary?: string;
  evolutionSummary?: string;
  slideCatalog: StoryboardSlideCatalogItem[];
}
