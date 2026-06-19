"use client";

import { ImportWizard, type ImportWizardResult } from "@/components/workflow/import/ImportWizard";

interface IntakeWorkspaceProps {
  onImportComplete: (result: ImportWizardResult) => void;
  onContinueToScheme: () => void;
}

export function IntakeWorkspace({ onImportComplete, onContinueToScheme }: IntakeWorkspaceProps) {
  return (
    <ImportWizard
      onContinueToTrace={onContinueToScheme}
      onImportComplete={onImportComplete}
    />
  );
}
