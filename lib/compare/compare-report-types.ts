export interface CompareReportVersionRow {
  id: string;
  label: string;
  isActive: boolean;
  isRecommended: boolean;
  roomCount: number;
  grossArea: number;
  netArea: number;
  totalScore: number;
  areaEfficiency: number;
  circulationScore: number;
  daylightScore: number;
  mepAlignmentScore: number;
  riskCount: number;
  strategy?: string;
}

export interface CompareReportRecommendation {
  versionId: string;
  versionLabel: string;
  summary: string;
  explanations: string[];
  comparedAgainstLabel: string;
  leftTotal: number;
  rightTotal: number;
}

export interface CompareReportDiff {
  baseLabel: string;
  previewLabel: string;
  added: number;
  modified: number;
  removed: number;
  svg: string;
}

export interface CompareReport {
  projectName: string;
  projectType: string;
  generatedAt: string;
  levelName?: string;
  pinnedVersionLabels: string[];
  versions: CompareReportVersionRow[];
  recommendation: CompareReportRecommendation;
  diff?: CompareReportDiff;
  metricTable: {
    headers: string[];
    rows: string[][];
  };
}
