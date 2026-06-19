import type { ReportSection } from "@/lib/report-types";

export function enforceSectionScope(
  original: ReportSection[],
  aiModified: ReportSection[],
  allowedId: string
): ReportSection[] {
  return original.map((section) =>
    section.id === allowedId ? (aiModified.find((item) => item.id === section.id) ?? section) : section
  );
}

export interface SectionScopeViolation {
  sectionId: string;
  message: string;
}

export function detectSectionScopeViolations(
  original: ReportSection[],
  aiModified: ReportSection[],
  allowedId: string
): SectionScopeViolation[] {
  const violations: SectionScopeViolation[] = [];
  const modifiedById = new Map(aiModified.map((section) => [section.id, section]));

  original.forEach((section) => {
    if (section.id === allowedId) {
      return;
    }

    const candidate = modifiedById.get(section.id);

    if (!candidate) {
      return;
    }

    if (JSON.stringify(candidate) !== JSON.stringify(section)) {
      violations.push({
        sectionId: section.id,
        message: `AI attempted to modify section ${section.id} outside allowed scope.`
      });
    }
  });

  return violations;
}
