export type ReportBlockType = "paragraph" | "table" | "image_ref" | "bullet_list";

export interface ReportBlock {
  id: string;
  type: ReportBlockType;
  content?: string;
  bullets?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  imageRef?: {
    kind: "plan" | "diagram";
    caption?: string;
  };
}

export interface ReportSectionGrounding {
  versionId: string;
  generatedAt: string;
  facts: Record<string, string | number | string[]>;
}

export interface ReportSection {
  id: string;
  title: string;
  blocks: ReportBlock[];
  grounding: ReportSectionGrounding;
}

export interface ReportDocument {
  id: string;
  title: string;
  sections: ReportSection[];
}

export type SlideTemplate = "title" | "content_image" | "table_full" | "two_column";

export interface SlideElement {
  blockRef: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Slide {
  id: string;
  sourceSectionId?: string;
  template: SlideTemplate;
  elements: SlideElement[];
}

export interface SlideLayout {
  id: string;
  slides: Slide[];
}
