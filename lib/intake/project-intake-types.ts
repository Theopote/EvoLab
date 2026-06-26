export interface ProjectIntakeRecord {
  summary: string;
  constraints: string[];
  risks: string[];
  opportunities: string[];
  openQuestions: string[];
  updatedAt?: string;
}

export function createEmptyIntakeRecord(): ProjectIntakeRecord {
  return {
    summary: "",
    constraints: [],
    risks: [],
    opportunities: [],
    openQuestions: []
  };
}
