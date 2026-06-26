export type IntakeSourceKind = "text" | "pdf" | "image" | "url";

export interface IntakeSourceFile {
  id: string;
  fileName: string;
  mimeType: string;
  kind: IntakeSourceKind;
  addedAt: string;
  excerpt?: string;
  url?: string;
}

export interface ProjectIntakeRecord {
  summary: string;
  constraints: string[];
  risks: string[];
  opportunities: string[];
  openQuestions: string[];
  sourceFiles?: IntakeSourceFile[];
  lastSynthesizedAt?: string;
  updatedAt?: string;
}

export function createEmptyIntakeRecord(): ProjectIntakeRecord {
  return {
    summary: "",
    constraints: [],
    risks: [],
    opportunities: [],
    openQuestions: [],
    sourceFiles: []
  };
}
