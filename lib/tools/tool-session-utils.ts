import type { PlanVersion } from "@/lib/project-types";
import type {
  ToolSessionDetail,
  ToolSessionOutput,
  ToolSessionPlanVersionOutput,
  ToolSessionPresentationDeckOutput
} from "@/lib/tools/tool-session-types";

export function createToolSessionOutputId() {
  return `tool-output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOutput(output: Record<string, unknown>, fallbackLabel: string): ToolSessionOutput {
  const kind = output.kind as ToolSessionOutput["kind"];
  const id = typeof output.id === "string" ? output.id : createToolSessionOutputId();
  const createdAt = typeof output.createdAt === "string" ? output.createdAt : new Date().toISOString();
  const label = typeof output.label === "string" ? output.label : fallbackLabel;

  switch (kind) {
    case "plan-version": {
      const planVersion = output.planVersion as ToolSessionPlanVersionOutput["planVersion"] | undefined;
      if (!planVersion) {
        throw new Error("plan-version output requires planVersion.");
      }

      return {
        id,
        kind: "plan-version",
        label,
        createdAt,
        planVersion,
        recognizedPlanVersion: output.recognizedPlanVersion as ToolSessionPlanVersionOutput["recognizedPlanVersion"],
        sourcePlanVersion: output.sourcePlanVersion as ToolSessionPlanVersionOutput["sourcePlanVersion"],
        referencePreviewUrl:
          typeof output.referencePreviewUrl === "string" ? output.referencePreviewUrl : undefined
      };
    }
    case "presentation-deck": {
      const deck = output.deck as ToolSessionPresentationDeckOutput["deck"] | undefined;
      if (!deck) {
        throw new Error("presentation-deck output requires deck.");
      }

      return {
        id,
        kind: "presentation-deck",
        label,
        createdAt,
        deck
      };
    }
    case "image-brief": {
      const briefs = output.briefs as string[] | undefined;
      if (!briefs) {
        throw new Error("image-brief output requires briefs.");
      }

      return {
        id,
        kind: "image-brief",
        label,
        createdAt,
        briefs,
        massingNotes: typeof output.massingNotes === "string" ? output.massingNotes : undefined
      };
    }
    case "file-export": {
      const fileName = output.fileName;
      const mimeType = output.mimeType;
      if (typeof fileName !== "string" || typeof mimeType !== "string") {
        throw new Error("file-export output requires fileName and mimeType.");
      }

      return {
        id,
        kind: "file-export",
        label,
        createdAt,
        fileName,
        mimeType,
        dataUrl: typeof output.dataUrl === "string" ? output.dataUrl : undefined
      };
    }
    default:
      throw new Error(`Unsupported tool session output kind: ${kind}`);
  }
}

export function normalizeToolSessionOutputs(
  outputs: unknown,
  fallbackLabel: string
): ToolSessionOutput[] {
  if (!outputs) {
    return [];
  }

  if (Array.isArray(outputs)) {
    return outputs.map((output) => normalizeOutput(output as Record<string, unknown>, fallbackLabel));
  }

  if (typeof outputs === "object" && outputs !== null && "kind" in outputs) {
    return [normalizeOutput(outputs as Record<string, unknown>, fallbackLabel)];
  }

  return [];
}

export function normalizeToolSession(session: ToolSessionDetail): ToolSessionDetail {
  return {
    ...session,
    outputs: normalizeToolSessionOutputs(session.outputs, session.title)
  };
}

export function getPlanVersionOutput(session: ToolSessionDetail | undefined): ToolSessionPlanVersionOutput | undefined {
  return session?.outputs.find((output): output is ToolSessionPlanVersionOutput => output.kind === "plan-version");
}

export function getOutputsByKind<K extends ToolSessionOutput["kind"]>(
  session: ToolSessionDetail | undefined,
  kind: K
): Extract<ToolSessionOutput, { kind: K }>[] {
  if (!session) {
    return [];
  }

  return session.outputs.filter((output): output is Extract<ToolSessionOutput, { kind: K }> => output.kind === kind);
}

export function upsertPlanVersionOutput(
  outputs: ToolSessionOutput[],
  patch: {
    label?: string;
    planVersion: ToolSessionPlanVersionOutput["planVersion"];
    recognizedPlanVersion?: PlanVersion;
    sourcePlanVersion?: PlanVersion;
    referencePreviewUrl?: string;
  }
): ToolSessionOutput[] {
  const existing = outputs.find((output) => output.kind === "plan-version");

  if (existing?.kind === "plan-version") {
    return outputs.map((output) =>
      output.kind === "plan-version"
        ? {
            ...existing,
            ...patch,
            label: patch.label ?? existing.label,
            recognizedPlanVersion: patch.recognizedPlanVersion ?? existing.recognizedPlanVersion,
            sourcePlanVersion: patch.sourcePlanVersion ?? existing.sourcePlanVersion,
            referencePreviewUrl: patch.referencePreviewUrl ?? existing.referencePreviewUrl
          }
        : output
    );
  }

  return [
    ...outputs,
    {
      id: createToolSessionOutputId(),
      kind: "plan-version",
      label: patch.label ?? "Plan version",
      createdAt: new Date().toISOString(),
      planVersion: patch.planVersion,
      recognizedPlanVersion: patch.recognizedPlanVersion,
      sourcePlanVersion: patch.sourcePlanVersion,
      referencePreviewUrl: patch.referencePreviewUrl
    }
  ];
}
