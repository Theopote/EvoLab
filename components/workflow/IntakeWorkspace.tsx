"use client";

import { ImportWizard, type ImportWizardResult } from "@/components/workflow/import/ImportWizard";
import { ProjectIntakePanel } from "@/components/workflow/intake/ProjectIntakePanel";

interface IntakeWorkspaceProps {
  onImportComplete: (result: ImportWizardResult) => void;
  onContinueToScheme: () => void;
}

export function IntakeWorkspace({ onImportComplete, onContinueToScheme }: IntakeWorkspaceProps) {
  return (
    <section className="grid min-h-full gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
      <ImportWizard onContinueToTrace={onContinueToScheme} onImportComplete={onImportComplete} />
      <ProjectIntakePanel />
    </section>
  );
}
