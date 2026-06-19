"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { DiffPreviewOverlay } from "@/components/floor-plan/DiffPreviewOverlay";
import { VerticalSectionView } from "@/components/workflow/VerticalSectionView";
import { captureInpaintImagesFromBBox } from "@/lib/inpaint-capture";
import type { PlanVersion, VerticalAlignmentIssue } from "@/lib/project-types";
import { buildVerticalAlignmentReport } from "@/lib/vertical-alignment";
import { buildAlignmentFixPackage } from "@/lib/vertical-alignment-fix";

interface VerticalAlignmentPanelProps {
  version: PlanVersion;
  activeLevelId?: string;
  onMarkTransferFloor?: (levelId: string) => void;
  onApplyRevision?: (version: PlanVersion, prompt: string) => void;
}

export function VerticalAlignmentPanel({
  version,
  activeLevelId,
  onMarkTransferFloor,
  onApplyRevision
}: VerticalAlignmentPanelProps) {
  const report = useMemo(() => buildVerticalAlignmentReport(version), [version]);
  const [fixingIssueId, setFixingIssueId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{
    version: PlanVersion;
    prompt: string;
    warning?: string;
    highlightRoomIds: string[];
  } | null>(null);

  if (version.levels.length <= 1) {
    return (
      <section className="rounded border border-line bg-[#0b1118] p-3 text-xs text-muted">
        Expand to multiple floors to inspect vertical structural alignment.
      </section>
    );
  }

  async function fixIssue(issue: VerticalAlignmentIssue) {
    if (!onApplyRevision || fixingIssueId) {
      return;
    }

    const fixPackage = buildAlignmentFixPackage(version, issue);

    if (!fixPackage) {
      setNotice("This alignment issue cannot be auto-fixed (no point-based structural position).");
      return;
    }

    setFixingIssueId(issue.id);
    setNotice(null);

    try {
      const { baseImage, maskImage } = await captureInpaintImagesFromBBox(
        version,
        fixPackage.maskBBox,
        fixPackage.levelId
      );
      const response = await fetch("/api/inpaint-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          userRequest: fixPackage.userRequest,
          baseImage,
          maskImage,
          allowedRoomIds: fixPackage.allowedRoomIds,
          levelId: fixPackage.levelId,
          structuralConstraints: fixPackage.structuralConstraints
        })
      });

      const data = (await response.json()) as {
        version?: PlanVersion;
        warning?: string;
        structuralViolations?: string[];
        error?: string;
      };

      if (!response.ok || !data.version?.rooms) {
        throw new Error(data.error ?? `inpaint-plan failed with ${response.status}`);
      }

      const warning = [data.warning, ...(data.structuralViolations ?? [])].filter(Boolean).join(" ");

      setPendingPreview({
        version: data.version,
        prompt: fixPackage.userRequest,
        warning: warning || undefined,
        highlightRoomIds: fixPackage.highlightRoomIds
      });
      setNotice("Review the alignment fix preview before accepting.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Alignment fix request failed.");
    } finally {
      setFixingIssueId(null);
    }
  }

  function acceptPreview() {
    if (!pendingPreview || !onApplyRevision) {
      return;
    }

    onApplyRevision(pendingPreview.version, pendingPreview.prompt);
    setPendingPreview(null);
    setNotice(pendingPreview.warning ? `Applied with note: ${pendingPreview.warning}` : "Alignment fix applied.");
  }

  function rejectPreview() {
    setPendingPreview(null);
    setNotice("Alignment fix preview rejected.");
  }

  return (
    <section className="grid gap-3">
      {pendingPreview ? (
        <DiffPreviewOverlay
          baseVersion={version}
          highlightRoomIds={pendingPreview.highlightRoomIds}
          notice={pendingPreview.warning}
          previewVersion={pendingPreview.version}
          title="Vertical alignment fix preview"
          onAccept={acceptPreview}
          onReject={rejectPreview}
        />
      ) : null}

      <div className="grid gap-3 rounded border border-line bg-[#0b1118] p-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-slate-100">Vertical Section</h3>
              <p className="text-xs text-muted">Floors by elevation; red marks column/core breaks.</p>
            </div>
            <span
              className={`rounded border px-2 py-1 text-[11px] ${
                report.aligned ? "border-success/40 text-success" : "border-warning/40 text-warning"
              }`}
            >
              {report.aligned ? "Aligned" : `${report.issues.length} issues`}
            </span>
          </div>
          <VerticalSectionView version={version} activeLevelId={activeLevelId} className="w-full" />
        </div>

        <div className="min-h-0">
          <h3 className="mb-2 text-sm font-medium text-slate-100">Alignment Issues</h3>
          <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
            {report.issues.length === 0 ? (
              <div className="flex items-start gap-2 rounded border border-success/30 bg-success/5 p-2 text-xs text-slate-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>All derived columns and vertical cores have valid container rooms on served floors.</span>
              </div>
            ) : (
              report.issues.map((issue) => (
                <div
                  className="rounded border border-warning/30 bg-warning/5 p-2 text-xs text-slate-200"
                  key={issue.id}
                >
                  <div className="mb-1 flex items-center gap-2 font-medium text-slate-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    {issue.floorName}
                  </div>
                  <p className="mb-2">{issue.message}</p>
                  {onApplyRevision && issue.position ? (
                    <button
                      className="inline-flex items-center gap-1 rounded border border-accent/40 px-2 py-1 text-[11px] text-accent disabled:opacity-50"
                      disabled={Boolean(fixingIssueId) || Boolean(pendingPreview)}
                      type="button"
                      onClick={() => void fixIssue(issue)}
                    >
                      <Sparkles className="h-3 w-3" />
                      {fixingIssueId === issue.id ? "Fixing..." : "Fix with AI"}
                    </button>
                  ) : null}
                </div>
              ))
            )}

            {report.transferHints.map((hint) => (
              <div
                className="rounded border border-info/30 bg-info/5 p-2 text-xs text-slate-200"
                key={hint.id}
              >
                <div className="mb-1 font-medium text-slate-100">Transfer floor hint</div>
                <p className="mb-2">{hint.message}</p>
                {onMarkTransferFloor ? (
                  <button
                    className="rounded border border-info/40 px-2 py-1 text-[11px] text-info"
                    type="button"
                    onClick={() => onMarkTransferFloor(hint.beforeLevelId)}
                  >
                    Mark {hint.beforeLevelId} as transfer floor
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {notice ? <p className="text-xs text-warning">{notice}</p> : null}
    </section>
  );
}
