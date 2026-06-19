"use client";

import { FileUp, ScanLine, Wand2 } from "lucide-react";
import { useInteractionStore } from "@/lib/interaction-store";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";

interface IntakeWorkspaceProps {
  onContinueToScheme: () => void;
}

export function IntakeWorkspace({ onContinueToScheme }: IntakeWorkspaceProps) {
  const setActiveTool = useInteractionStore((state) => state.setActiveTool);
  const requestUploadPicker = useCopilotUploadStore((state) => state.requestUploadPicker);

  return (
    <section className="grid min-h-full place-items-center">
      <div className="w-full max-w-2xl rounded border border-line bg-panel/90 p-6">
        <h1 className="text-lg font-semibold text-white">Import & Trace</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Bring existing drawings into EvoLab or trace room boundaries. Imports create a new scheme version; trace mode
          works on the active floor plan in Scheme.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <IntakeAction
            icon={FileUp}
            title="Import drawing"
            description="Upload CAD, PDF, or image. Copilot recognizes rooms and creates a traceable version."
            onClick={() => {
              setActiveTool("upload");
              requestUploadPicker();
            }}
          />
          <IntakeAction
            icon={Wand2}
            title="Trace vertices"
            description="Switch to Scheme and trace room polygons over the floor plan canvas."
            onClick={() => {
              onContinueToScheme();
              setActiveTool("trace");
            }}
          />
          <IntakeAction
            icon={ScanLine}
            title="Vision analyze"
            description="Use Copilot console below to attach a plan image and run analyze-plan."
            onClick={() => {
              setActiveTool("upload");
              requestUploadPicker();
            }}
          />
        </div>

        <p className="mt-6 text-xs text-muted">
          Tip: finish Site and Program in Intake before generating schemes — the domain model keeps site, program, and
          versions linked.
        </p>
      </div>
    </section>
  );
}

function IntakeAction({
  icon: Icon,
  title,
  description,
  onClick
}: {
  icon: typeof FileUp;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className="rounded border border-line bg-[#0b1118] p-4 text-left transition hover:border-accent/50 hover:bg-accent/5"
      type="button"
      onClick={onClick}
    >
      <Icon className="h-5 w-5 text-accent" />
      <div className="mt-3 text-sm font-medium text-white">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
    </button>
  );
}
