"use client";

import { useCallback, useState } from "react";
import type { ScoringConfig } from "@/lib/building-domain";
import {
  buildComplianceFixPackageById,
  isComplianceFixAction,
  requestComplianceFixPreview,
  type ComplianceFixPreview
} from "@/lib/compliance-fix";
import type { CopilotAction, PlanVersion } from "@/lib/project-types";

interface UseComplianceFixActionOptions {
  activeVersion?: PlanVersion;
  projectType: string;
  scoringConfig?: ScoringConfig;
  onBeforeFix?: () => void;
  onApplyPreview: (preview: ComplianceFixPreview) => void;
  onNotice?: (message: string) => void;
}

export function useComplianceFixAction({
  activeVersion,
  projectType,
  scoringConfig,
  onBeforeFix,
  onApplyPreview,
  onNotice
}: UseComplianceFixActionOptions) {
  const [pendingComplianceFix, setPendingComplianceFix] = useState<ComplianceFixPreview | null>(null);
  const [isComplianceFixing, setIsComplianceFixing] = useState(false);

  const runComplianceFixAction = useCallback(
    async (violationId: string) => {
      if (!activeVersion || isComplianceFixing) {
        return;
      }

      const fixPackage = buildComplianceFixPackageById(activeVersion, violationId, {
        buildingType: projectType,
        scoringConfig
      });

      if (!fixPackage) {
        onNotice?.("This compliance issue cannot be auto-fixed yet. Try a manual inpaint edit on the affected floor.");
        return;
      }

      setIsComplianceFixing(true);
      onBeforeFix?.();

      try {
        const preview = await requestComplianceFixPreview(activeVersion, fixPackage);
        setPendingComplianceFix(preview);
        onNotice?.(`Prepared a localized fix preview for ${fixPackage.floorName}. Review before accepting.`);
      } catch (error) {
        onNotice?.(error instanceof Error ? error.message : "Compliance fix request failed.");
      } finally {
        setIsComplianceFixing(false);
      }
    },
    [activeVersion, isComplianceFixing, onBeforeFix, onNotice, projectType, scoringConfig]
  );

  const handleComplianceAction = useCallback(
    (action: CopilotAction) => {
      if (!isComplianceFixAction(action) || !action.payload) {
        return false;
      }

      void runComplianceFixAction(action.payload);
      return true;
    },
    [runComplianceFixAction]
  );

  const acceptComplianceFixPreview = useCallback(() => {
    if (!pendingComplianceFix) {
      return;
    }

    const preview = pendingComplianceFix;
    setPendingComplianceFix(null);
    onApplyPreview(preview);
  }, [onApplyPreview, pendingComplianceFix]);

  const rejectComplianceFixPreview = useCallback(() => {
    setPendingComplianceFix(null);
    onNotice?.("Compliance fix preview rejected.");
  }, [onNotice]);

  return {
    pendingComplianceFix,
    isComplianceFixing,
    runComplianceFixAction,
    handleComplianceAction,
    acceptComplianceFixPreview,
    rejectComplianceFixPreview
  };
}
