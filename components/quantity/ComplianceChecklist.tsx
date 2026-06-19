"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { DiffPreviewOverlay } from "@/components/floor-plan/DiffPreviewOverlay";
import { useComplianceFixAction } from "@/components/copilot/useComplianceFixAction";
import type { ScoringConfig } from "@/lib/building-domain";
import { complianceFixLabel } from "@/lib/compliance-rules";
import { isComplianceFixAction } from "@/lib/compliance-fix";
import type { ComplianceItem } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

interface ComplianceChecklistProps {
  items: ComplianceItem[];
  activeVersion?: PlanVersion;
  projectType?: string;
  scoringConfig?: ScoringConfig;
  onApplyRevision?: (version: PlanVersion, prompt: string) => void;
}

export function ComplianceChecklist({
  items,
  activeVersion,
  projectType = "healthcare",
  scoringConfig,
  onApplyRevision
}: ComplianceChecklistProps) {
  const warningCount = items.filter((item) => item.status === "warning").length;
  const {
    pendingComplianceFix,
    isComplianceFixing,
    runComplianceFixAction,
    acceptComplianceFixPreview,
    rejectComplianceFixPreview
  } = useComplianceFixAction({
    activeVersion,
    projectType,
    scoringConfig,
    onApplyPreview: (preview) => {
      onApplyRevision?.(preview.version, preview.prompt);
    }
  });

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      {pendingComplianceFix && activeVersion ? (
        <div className="mb-3">
          <DiffPreviewOverlay
            baseVersion={activeVersion}
            highlightRoomIds={pendingComplianceFix.highlightRoomIds}
            notice={pendingComplianceFix.warning}
            previewVersion={pendingComplianceFix.version}
            title="Compliance fix preview"
            onAccept={acceptComplianceFixPreview}
            onReject={rejectComplianceFixPreview}
          />
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Compliance Checks</h2>
          <p className="mt-1 text-xs text-muted">Early-stage rule checks from activeVersion data.</p>
        </div>
        <span
          className={`rounded border px-2 py-1 text-xs ${
            warningCount > 0 ? "border-warning/40 text-warning" : "border-success/40 text-success"
          }`}
        >
          {warningCount} warnings
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.status === "warning" ? AlertTriangle : CheckCircle2;
          const tone = item.status === "warning" ? "text-warning" : "text-success";
          const canFix =
            item.status === "warning" &&
            item.fixActionId &&
            isComplianceFixAction({ id: item.fixActionId, label: "fix" }) &&
            Boolean(activeVersion && onApplyRevision);

          return (
            <article className="rounded border border-line bg-[#0b1118] p-3" key={item.id}>
              <div className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.message}</p>
                  <p className="mt-2 text-[11px] leading-4 text-muted">{item.basis}</p>
                  {canFix ? (
                    <button
                      className="mt-2 inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-accent disabled:opacity-50"
                      disabled={isComplianceFixing || Boolean(pendingComplianceFix)}
                      type="button"
                      onClick={() => void runComplianceFixAction(item.id)}
                    >
                      <Sparkles className="h-3 w-3" />
                      {complianceFixLabel(
                        item.ruleId ?? item.id,
                        item.scope === "building_wide" ? "building_wide" : "single_floor"
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
