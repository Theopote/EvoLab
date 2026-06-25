"use client";

import { AlertTriangle, Bot, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiTimelinePanel } from "@/components/copilot/AiTimelinePanel";
import { CopilotProposalHistoryPanel } from "@/components/copilot/CopilotProposalHistoryPanel";
import { PlanChangeProposalPanel } from "@/components/copilot/PlanChangeProposalPanel";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import { useEvoProject } from "@/lib/project-store";
import type {
  CopilotAction,
  CopilotFinding,
  CopilotMessage,
  PlanVersion,
  Point,
  WorkspaceTab
} from "@/lib/project-types";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import { diffRoomIds } from "@/lib/design-decision-log";
import { pendingInsightCount } from "@/lib/copilot-insight-queue";
import { detectCopilotPlan, type CopilotPlan } from "@/lib/copilot-plan";
import { normalizeWorkspaceTab } from "@/lib/workflow-navigation";
import { isImagePinnedFile, readCopilotUpload, type CopilotPinnedFile } from "@/lib/copilot-upload";
import { useShallow } from "zustand/react/shallow";

interface CopilotConsoleProps {
  projectVersions: PlanVersion[];
  activeVersion?: PlanVersion;
  activeTab: WorkspaceTab;
  outline: Point[];
  projectType: string;
  onCopilotRevision: (version: PlanVersion, prompt: string, parentVersion: PlanVersion) => void;
  onAnalyzedVersion: (version: PlanVersion, source: { fileName: string; prompt?: string }) => void;
  onSelectVersion: (version: PlanVersion) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onRegeneratePlan: () => void;
}

const promptChips = [
  "Move the core to the north side",
  "Optimize egress distance",
  "Improve daylight for consultation rooms",
  "Merge southwest offices into open workspace"
];

export function CopilotConsole({
  projectVersions,
  activeVersion,
  activeTab,
  outline,
  projectType,
  onCopilotRevision,
  onAnalyzedVersion,
  onSelectVersion,
  onTabChange,
  onRegeneratePlan
}: CopilotConsoleProps) {
  const [expanded, setExpanded] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pinnedFiles, setPinnedFiles] = useState<CopilotPinnedFile[]>([]);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<CopilotPlan | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    copilotProposals,
    lockedElementIds,
    registerCopilotProposal,
    applyCopilotProposal,
    dismissCopilotProposal,
    addCopilotProposalComment,
    refreshCopilotInsights,
    reviewCopilotInsights,
    recordDesignDecision
  } = useEvoProject(
    useShallow((state) => ({
      copilotProposals: state.project.domain.copilotProposals,
      lockedElementIds: state.project.domain.lockedElementIds,
      registerCopilotProposal: state.registerCopilotProposal,
      applyCopilotProposal: state.applyCopilotProposal,
      dismissCopilotProposal: state.dismissCopilotProposal,
      addCopilotProposalComment: state.addCopilotProposalComment,
      refreshCopilotInsights: state.refreshCopilotInsights,
      reviewCopilotInsights: state.reviewCopilotInsights,
      recordDesignDecision: state.recordDesignDecision
    }))
  );
  const insightQueue = useEvoProject((state) => state.project.domain.copilotInsightQueue);
  const pendingInsights = pendingInsightCount(insightQueue);
  const pendingProposal = useMemo(() => {
    if (!pendingProposalId) {
      return null;
    }

    const stored = copilotProposals.find((item) => item.id === pendingProposalId);

    if (!stored || stored.status !== "draft") {
      return null;
    }

    const baseVersion =
      projectVersions.find((version) => version.id === stored.baseVersionId) ?? stored.baseVersionSnapshot;

    if (!baseVersion) {
      return null;
    }

    return { ...stored, baseVersion };
  }, [copilotProposals, pendingProposalId, projectVersions]);
  const uploadRequestId = useCopilotUploadStore((state) => state.uploadRequestId);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Evo Copilot is connected to the active PlanVersion. Each edit forks a new version on the timeline."
    }
  ]);
  const entries = useCopilotTimelineStore((state) => state.entries);
  const markUndone = useCopilotTimelineStore((state) => state.markUndone);

  const contextRows = useMemo(
    () => [
      ["Outline", `${outline.length} pts`],
      ["Type", projectType],
      ["Scheme", activeVersion?.label ?? "None"],
      ["Tab", activeTab]
    ],
    [activeTab, activeVersion?.label, outline.length, projectType]
  );

  useEffect(() => {
    if (uploadRequestId > 0) {
      fileInputRef.current?.click();
    }
  }, [uploadRequestId]);

  useEffect(() => {
    if (activeVersion) {
      refreshCopilotInsights();
    }
  }, [activeVersion?.id, activeVersion?.rooms, refreshCopilotInsights]);

  async function handleFileSelection(fileList: FileList | null) {
    const file = fileList?.[0];

    if (!file) {
      return;
    }

    try {
      const pinned = await readCopilotUpload(file);
      setPinnedFiles((current) => [...current, pinned].slice(0, 3));
      setMessages((current) => [
        ...current,
        {
          id: `assistant-upload-${Date.now()}`,
          role: "assistant",
          content: `Pinned ${file.name} (${pinned.sourceType.toUpperCase()}). Add a prompt to align the active scheme, or send without text to import the drawing.`
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-upload-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Failed to read uploaded file."
        }
      ]);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function analyzePinnedDrawing(files = pinnedFiles) {
    const file = files[0];

    if (!file || isSending) {
      return;
    }

    setIsSending(true);
    setMessages((current) => [
      ...current,
      {
        id: `user-analyze-${Date.now()}`,
        role: "user",
        content: `Recognize plan from ${file.fileName}`
      }
    ]);

    try {
      const response = await fetch("/api/analyze-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: file.base64,
          fileName: file.fileName,
          sourceType: file.sourceType
        })
      });

      if (!response.ok) {
        throw new Error(`analyze-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        version?: PlanVersion;
        warnings?: string[];
        confidence?: number;
        importPath?: "vision" | "structured";
        sourceType?: string;
      };

      if (!data.version?.rooms) {
        throw new Error("analyze-plan did not return a complete PlanVersion.");
      }

      const analyzedVersion = data.version;
      onAnalyzedVersion(analyzedVersion, { fileName: file.fileName });
      setPinnedFiles([]);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-analyze-${Date.now()}`,
          role: "assistant",
          content: `Imported ${analyzedVersion.label} from ${file.fileName} via ${data.importPath ?? "import"}${
            data.warnings?.length ? ` (${data.warnings.join(" ")})` : ""
          }.`
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-analyze-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Plan recognition failed."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function submitMessage(messageText = input, baseVersion = activeVersion, files = pinnedFiles) {
    const text = messageText.trim();

    if (isSending) {
      return;
    }

    if (!text && files.length > 0) {
      await analyzePinnedDrawing(files);
      return;
    }

    if (!text || !baseVersion) {
      return;
    }

    const plan = detectCopilotPlan(text);

    if (plan?.requiresConfirmation) {
      setPendingPlan(plan);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-plan-${Date.now()}`,
          role: "assistant",
          content: "This request spans multiple modules. Review the plan below before executing."
        }
      ]);
      return;
    }

    setInput("");
    setIsSending(true);
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", content: text }]);

    try {
      const response = await fetch("/api/modify-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: baseVersion,
          userRequest: text,
          lockedElementIds,
          allVersions: projectVersions,
          referenceImages: files
            .filter(isImagePinnedFile)
            .map((file) => ({
              base64: file.base64,
              mediaType: file.mediaType!,
              fileName: file.fileName
            }))
        })
      });

      if (!response.ok) {
        throw new Error(`modify-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as ModifyPlanResponse;

      if (!data.version?.rooms) {
        throw new Error("modify-plan did not return a usable PlanVersion.");
      }

      if (!data.proposal?.operations?.length) {
        throw new Error("modify-plan did not return a change proposal.");
      }

      const stored = registerCopilotProposal({
        prompt: text,
        baseVersion,
        proposal: data.proposal,
        findings: data.findings ?? [],
        warning: data.warning
      });

      setPendingProposalId(stored.id);
      setPinnedFiles([]);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.warning
            ? `Copilot prepared a change proposal (fallback). ${data.warning}`
            : "Copilot prepared a change proposal. Review each operation before forking a new version."
        },
        {
          id: `findings-${Date.now()}`,
          role: "findings",
          title: "Copilot findings",
          items: data.findings ?? []
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Copilot request failed."
        }
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function applyPendingProposal(version: PlanVersion, acceptedOperationIds: string[]) {
    if (!pendingProposal) {
      return;
    }

    const result = applyCopilotProposal(pendingProposal.id, version, acceptedOperationIds);

    if (!result) {
      return;
    }

    onCopilotRevision(result.resultVersion, result.prompt, result.parentVersion);
    recordDesignDecision({
      trigger: "ai_suggestion_accepted",
      description: pendingProposal.proposal.intent,
      affectedRoomIds: diffRoomIds(result.parentVersion, result.resultVersion),
      versionIdBefore: result.parentVersion.id,
      versionIdAfter: result.resultVersion.id
    });
    setPendingProposalId(null);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-applied-${Date.now()}`,
        role: "assistant",
        content: `Applied selected changes for: ${pendingProposal.proposal.intent}`
      }
    ]);
  }

  function dismissPendingProposal() {
    if (pendingProposal) {
      dismissCopilotProposal(pendingProposal.id);
    }

    setPendingProposalId(null);
  }

  function handleUndo(entryId: string, parentVersionId: string) {
    const parent = projectVersions.find((version) => version.id === parentVersionId);

    if (!parent) {
      return;
    }

    onSelectVersion(parent);
    markUndone(entryId);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-undo-${Date.now()}`,
        role: "assistant",
        content: `Reverted active scheme to ${parent.label}.`
      }
    ]);
  }

  function handleRegenerate(prompt: string, parentVersionId: string) {
    const parent = projectVersions.find((version) => version.id === parentVersionId);

    if (!parent) {
      return;
    }

    void submitMessage(prompt, parent);
  }

  function showPendingInsights() {
    const items = insightQueue?.pending ?? [];

    if (!items.length) {
      return;
    }

    reviewCopilotInsights();
    setMessages((current) => [
      ...current,
      {
        id: `findings-auto-${Date.now()}`,
        role: "findings",
        title: "New findings from analysis engines",
        items
      }
    ]);
  }

  function executePendingPlan() {
    if (!pendingPlan) {
      return;
    }

    pendingPlan.steps.forEach((step) => handleAction(step.action));
    setPendingPlan(null);
    setMessages((current) => [
      ...current,
      {
        id: `assistant-plan-applied-${Date.now()}`,
        role: "assistant",
        content: "Executed the confirmed multi-step plan."
      }
    ]);
  }

  function handleAction(action: CopilotAction) {
    if (action.id === "switch-tab") {
      onTabChange(normalizeWorkspaceTab(action.payload ?? "Massing"));
      return;
    }

    if (action.id === "generate-massing" || action.id === "generate-flow-diagram") {
      onTabChange(action.id === "generate-massing" ? "Massing" : "Analysis");
      return;
    }

    if (action.id === "regenerate-plan") {
      onRegeneratePlan();
    }
  }

  return (
    <section className="border-t border-line bg-[#0a0f15]">
      <button
        className="flex w-full items-center justify-between px-4 py-2 text-left"
        type="button"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-white">AI Copilot Console</span>
          <span className="rounded border border-line px-2 py-0.5 text-[11px] text-muted">
            {entries.length} timeline events
          </span>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronUp className="h-4 w-4 text-muted" />}
      </button>

      {expanded ? (
        <div className="grid h-[300px] grid-cols-[minmax(0,1fr)_280px] gap-3 border-t border-line px-4 pb-4 pt-3">
          <div className="flex min-h-0 flex-col rounded border border-line bg-panel/90 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Prompt stream</span>
              </div>
              {pendingInsights > 0 ? (
                <button
                  className="rounded border border-accent/50 bg-accent/10 px-2 py-1 text-[11px] text-accent"
                  type="button"
                  onClick={showPendingInsights}
                >
                  {pendingInsights} new finding{pendingInsights === 1 ? "" : "s"}
                </button>
              ) : null}
            </div>

            <div className="mb-2 grid grid-cols-4 gap-2">
              {contextRows.map(([label, value]) => (
                <div className="rounded border border-line bg-white/[0.03] p-2" key={label}>
                  <div className="text-[10px] text-muted">{label}</div>
                  <div className="mt-1 truncate text-[11px] text-slate-100">{value}</div>
                </div>
              ))}
            </div>

            <div className="mb-2 min-h-0 flex-1 space-y-2 overflow-auto rounded border border-line bg-[#0b1118] p-2">
              {pendingPlan ? (
                <div className="rounded border border-line bg-white/[0.03] p-2">
                  <div className="mb-2 text-xs font-medium text-slate-100">Proposed multi-step plan</div>
                  <ol className="space-y-1 text-xs text-muted">
                    {pendingPlan.steps.map((step, index) => (
                      <li key={`${step.description}-${index}`}>
                        {index + 1}. {step.description}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded border border-accent/50 px-2 py-1 text-[11px] text-accent"
                      type="button"
                      onClick={executePendingPlan}
                    >
                      Confirm all steps
                    </button>
                    <button
                      className="rounded border border-line px-2 py-1 text-[11px] text-muted"
                      type="button"
                      onClick={() => setPendingPlan(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
              {pendingProposal ? (
                <PlanChangeProposalPanel
                  baseVersion={pendingProposal.baseVersion}
                  lockedElementIds={lockedElementIds}
                  proposal={pendingProposal.proposal}
                  onAddComment={(text) => addCopilotProposalComment(pendingProposal.id, text)}
                  onApply={(version, acceptedOperationIds) => applyPendingProposal(version, acceptedOperationIds)}
                  onDismiss={dismissPendingProposal}
                />
              ) : null}
              {messages.map((message) => {
                if (message.role === "findings") {
                  return (
                    <div className="rounded border border-line bg-white/[0.03] p-2" key={message.id}>
                      <div className="mb-2 text-xs font-medium text-slate-100">{message.title}</div>
                      <div className="space-y-2">
                        {message.items.map((finding) => (
                          <FindingCard finding={finding} key={finding.id} onAction={handleAction} />
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    className={`rounded p-2 text-xs leading-5 ${
                      message.role === "user"
                        ? "ml-8 bg-accent/15 text-slate-100"
                        : "mr-8 border border-line bg-white/[0.03] text-slate-200"
                    }`}
                    key={message.id}
                  >
                    {message.content}
                  </div>
                );
              })}
            </div>

            <div className="mb-2 flex flex-wrap gap-1.5">
              {promptChips.map((chip) => (
                <button
                  className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-accent"
                  disabled={isSending || !activeVersion}
                  key={chip}
                  type="button"
                  onClick={() => void submitMessage(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>

            {pinnedFiles.length ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {pinnedFiles.map((file) => (
                  <div
                    className="flex items-center gap-2 rounded border border-accent/40 bg-accent/10 px-2 py-1"
                    key={file.id}
                  >
                    <img alt="" className="h-8 w-8 rounded object-cover" src={file.previewUrl} />
                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-slate-100">{file.fileName}</div>
                      <div className="text-[10px] text-muted">Reference pin</div>
                    </div>
                    <button
                      className="text-muted hover:text-accent"
                      type="button"
                      aria-label={`Remove ${file.fileName}`}
                      onClick={() => setPinnedFiles((current) => current.filter((item) => item.id !== file.id))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage();
              }}
            >
              <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded border border-line text-muted hover:border-accent/50 hover:text-accent">
                <input
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.dxf,application/pdf"
                  className="hidden"
                  type="file"
                  onChange={(event) => void handleFileSelection(event.target.files)}
                />
                <Paperclip className="h-3.5 w-3.5" />
              </label>
              <input
                className="h-9 min-w-0 flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
                disabled={isSending}
                placeholder={
                  activeVersion
                    ? "Describe a design change, or send a pinned drawing to recognize..."
                    : "Pin a drawing and send to recognize a plan..."
                }
                value={input}
                onChange={(event) => setInput(event.target.value)}
              />
              <button
                className="grid h-9 w-9 place-items-center rounded bg-accent text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSending || (!input.trim() && pinnedFiles.length === 0)}
                type="submit"
                aria-label="Send"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <CopilotProposalHistoryPanel
              activeProposalId={pendingProposal?.id}
              proposals={copilotProposals}
              onSelectProposal={setPendingProposalId}
            />
            <AiTimelinePanel
              versions={projectVersions}
              activeVersionId={activeVersion?.id ?? ""}
              onUndo={handleUndo}
              onRegenerate={handleRegenerate}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function FindingCard({
  finding,
  onAction
}: {
  finding: CopilotFinding;
  onAction: (action: CopilotAction) => void;
}) {
  const Icon =
    finding.tone === "warning" ? AlertTriangle : finding.tone === "success" ? CheckCircle2 : Info;
  const toneClass =
    finding.tone === "warning"
      ? "text-warning"
      : finding.tone === "success"
        ? "text-success"
        : "text-accent";

  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <div className="flex gap-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${toneClass}`} />
        <div className="min-w-0">
          <div className="text-xs text-slate-100">{finding.text}</div>
          {finding.sub ? <div className="mt-1 text-[11px] leading-4 text-muted">{finding.sub}</div> : null}
        </div>
      </div>
      {finding.actions?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
          {finding.actions.map((action) => (
            <button
              className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-accent"
              key={`${finding.id}-${action.id}-${action.label}`}
              type="button"
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
