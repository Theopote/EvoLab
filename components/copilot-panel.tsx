"use client";

import { AlertTriangle, Bot, CheckCircle2, Info, Loader2, Send, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type {
  CopilotAction,
  CopilotFinding,
  CopilotMessage,
  PlanVersion,
  Point
} from "@/lib/project-types";
import type { WorkspaceTab } from "@/components/top-nav";

interface CopilotPanelProps {
  activeVersion?: PlanVersion;
  activeTab: WorkspaceTab;
  outline: Point[];
  projectType: string;
  onVersionUpdated: (version: PlanVersion) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onRegeneratePlan: () => void;
}

const promptChips = [
  "Move the core to the north side",
  "Optimize egress distance",
  "Improve daylight for consultation rooms",
  "Lay out shafts near plumbing rooms",
  "Generate patient flow diagram",
  "Create 3D model",
  "Recalculate areas",
  "Reduce risk count"
];

export function CopilotPanel({
  activeVersion,
  activeTab,
  outline,
  projectType,
  onVersionUpdated,
  onTabChange,
  onRegeneratePlan
}: CopilotPanelProps) {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Evo Copilot is connected to the active PlanVersion. Ask for design changes, not just comments."
    },
    {
      id: "baseline-findings",
      role: "findings",
      title: "Current checks",
      items: [
        {
          id: "data-source",
          tone: "success",
          text: "Plan, model and inspector are driven by the same activeVersion.",
          actions: [{ id: "switch-tab", label: "Open model", payload: "Model" }]
        }
      ]
    }
  ]);

  const contextRows = useMemo(
    () => [
      ["Outline", `${outline.length} pts`],
      ["Type", projectType],
      ["Scheme", activeVersion?.label ?? "None"],
      ["Tab", activeTab]
    ],
    [activeTab, activeVersion?.label, outline.length, projectType]
  );

  async function submitMessage(messageText = input) {
    const text = messageText.trim();

    if (!text || !activeVersion || isSending) {
      return;
    }

    setInput("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", content: text }
    ]);

    try {
      const response = await fetch("/api/modify-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: activeVersion,
          userRequest: text
        })
      });

      if (!response.ok) {
        throw new Error(`modify-plan failed with ${response.status}`);
      }

      const data = (await response.json()) as {
        version?: PlanVersion;
        findings?: CopilotFinding[];
        warning?: string;
      };

      if (!data.version?.rooms) {
        throw new Error("modify-plan did not return a complete PlanVersion.");
      }

      onVersionUpdated(data.version);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.warning
            ? `Fallback design update applied. ${data.warning}`
            : "Design data updated. The active plan, inspector and 3D model now reference the new version."
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

  function handleAction(action: CopilotAction) {
    if (action.id === "switch-tab") {
      const tab = action.payload as WorkspaceTab | undefined;
      onTabChange(tab ?? "Model");
      return;
    }

    if (action.id === "generate-massing" || action.id === "generate-flow-diagram") {
      onTabChange(action.id === "generate-massing" ? "Model" : "Analysis");
      return;
    }

    if (action.id === "regenerate-plan") {
      onRegeneratePlan();
      return;
    }

    if (action.id === "select-version" && action.payload) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-action-${Date.now()}`,
          role: "assistant",
          content: `Version selection requested: ${action.payload}`
        }
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `assistant-action-${Date.now()}`,
        role: "assistant",
        content: `${action.label} queued for a later module.`
      }
    ]);
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded border border-accent/40 bg-accent/10">
            <Bot className="h-4 w-4 text-accent" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Evo Copilot</h2>
            <p className="text-xs text-muted">Data-aware design edits</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-accent" />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {contextRows.map(([label, value]) => (
          <div className="rounded border border-line bg-white/[0.03] p-2" key={label}>
            <div className="text-[11px] text-muted">{label}</div>
            <div className="mt-1 truncate text-xs text-slate-100">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex max-h-80 flex-col gap-2 overflow-auto rounded border border-line bg-[#0b1118] p-2">
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
                  ? "ml-6 bg-accent/15 text-slate-100"
                  : "mr-6 border border-line bg-white/[0.03] text-slate-200"
              }`}
              key={message.id}
            >
              {message.content}
            </div>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {promptChips.map((chip) => (
          <button
            className="rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/60 hover:text-accent"
            disabled={isSending || !activeVersion}
            key={chip}
            type="button"
            onClick={() => submitMessage(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage();
        }}
      >
        <input
          className="h-9 min-w-0 flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending || !activeVersion}
          placeholder="Ask Evo to modify the active plan..."
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          className="grid h-9 w-9 place-items-center rounded bg-accent text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSending || !activeVersion || !input.trim()}
          type="submit"
          aria-label="Send"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
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
