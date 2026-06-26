import type { PresentationDeck } from "@/lib/presentation/types";
import type {
  ToolSessionDetail,
  ToolSessionInputFile,
  ToolSessionOutput,
  ToolSessionStoredMap,
  ToolSessionStoredOutput,
  ToolSessionStoredRecord
} from "@/lib/tools/tool-session-types";
import { normalizeToolSession } from "@/lib/tools/tool-session-utils";

export function isInlineDataUrl(value: string): boolean {
  return /^data:/i.test(value.trim());
}

/** Keep only external URLs; drop inline data: / base64 payloads before persistence. */
export function stripInlineDataUrl(url?: string): string | undefined {
  if (!url || isInlineDataUrl(url)) {
    return undefined;
  }

  return url;
}

export function sanitizeInputFile(file: ToolSessionInputFile): ToolSessionInputFile {
  return {
    fileName: file.fileName,
    sourceType: file.sourceType,
    sizeBytes: file.sizeBytes,
    previewUrl: stripInlineDataUrl(file.previewUrl)
  };
}

export function toStoredOutput(output: ToolSessionOutput): ToolSessionStoredOutput {
  const base = {
    id: output.id,
    kind: output.kind,
    label: output.label,
    createdAt: output.createdAt
  };

  switch (output.kind) {
    case "plan-version":
      return {
        ...base,
        kind: "plan-version",
        planVersion: output.planVersion,
        recognizedPlanVersion: output.recognizedPlanVersion,
        sourcePlanVersion: output.sourcePlanVersion,
        referencePreviewUrl: stripInlineDataUrl(output.referencePreviewUrl)
      };
    case "presentation-deck":
      return {
        ...base,
        kind: "presentation-deck",
        slideCount: output.deck.slides.length
      };
    case "image-brief":
      return {
        ...base,
        kind: "image-brief",
        briefCount: output.briefs.length
      };
    case "file-export":
      return {
        ...base,
        kind: "file-export",
        fileName: output.fileName,
        mimeType: output.mimeType
      };
    default:
      return base;
  }
}

function emptyPresentationDeck(stored: ToolSessionStoredOutput): PresentationDeck {
  return {
    projectName: stored.label,
    projectType: "restored",
    versionLabel: stored.label,
    generatedAt: stored.createdAt,
    slides: []
  };
}

export function fromStoredOutput(stored: ToolSessionStoredOutput): ToolSessionOutput {
  switch (stored.kind) {
    case "plan-version": {
      if (!stored.planVersion) {
        throw new Error("Stored plan-version output is missing planVersion.");
      }

      return {
        id: stored.id,
        kind: "plan-version",
        label: stored.label,
        createdAt: stored.createdAt,
        planVersion: stored.planVersion,
        recognizedPlanVersion: stored.recognizedPlanVersion,
        sourcePlanVersion: stored.sourcePlanVersion,
        referencePreviewUrl: stored.referencePreviewUrl
      };
    }
    case "presentation-deck":
      return {
        id: stored.id,
        kind: "presentation-deck",
        label: stored.label,
        createdAt: stored.createdAt,
        deck: emptyPresentationDeck(stored)
      };
    case "image-brief":
      return {
        id: stored.id,
        kind: "image-brief",
        label: stored.label,
        createdAt: stored.createdAt,
        briefs: []
      };
    case "file-export": {
      if (!stored.fileName || !stored.mimeType) {
        throw new Error("Stored file-export output is missing file metadata.");
      }

      return {
        id: stored.id,
        kind: "file-export",
        label: stored.label,
        createdAt: stored.createdAt,
        fileName: stored.fileName,
        mimeType: stored.mimeType
      };
    }
    default:
      throw new Error(`Unsupported stored tool session output kind: ${stored.kind}`);
  }
}

export function toStoredSession(session: ToolSessionDetail): ToolSessionStoredRecord {
  const normalized = normalizeToolSession(session);

  return {
    id: normalized.id,
    toolId: normalized.toolId,
    title: normalized.title,
    inputFiles: normalized.inputFiles?.map(sanitizeInputFile),
    parameters: normalized.parameters,
    outputs: normalized.outputs.map(toStoredOutput),
    analysisMeta: normalized.analysisMeta,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    canPromoteToProject: normalized.canPromoteToProject,
    linkedProjectId: normalized.linkedProjectId,
    status: normalized.status
  };
}

export function fromStoredSession(record: ToolSessionStoredRecord): ToolSessionDetail {
  return {
    id: record.id,
    toolId: record.toolId,
    title: record.title,
    inputFiles: record.inputFiles?.map(sanitizeInputFile),
    parameters: record.parameters,
    outputs: record.outputs.map(fromStoredOutput),
    analysisMeta: record.analysisMeta,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    canPromoteToProject: record.canPromoteToProject,
    linkedProjectId: record.linkedProjectId,
    status: record.status
  };
}

function isStoredOutput(value: unknown): value is ToolSessionStoredOutput {
  return Boolean(value && typeof value === "object" && "kind" in value && "id" in value && !("deck" in value));
}

function normalizeLegacyOutput(raw: Record<string, unknown>): ToolSessionStoredOutput | undefined {
  const kind = raw.kind;

  if (kind === "plan-version") {
    if (!raw.planVersion || typeof raw.planVersion !== "object") {
      return undefined;
    }

    return toStoredOutput({
      id: typeof raw.id === "string" ? raw.id : `tool-output-${Date.now()}`,
      kind: "plan-version",
      label: typeof raw.label === "string" ? raw.label : "Plan version",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      planVersion: raw.planVersion as NonNullable<ToolSessionStoredOutput["planVersion"]>,
      recognizedPlanVersion: raw.recognizedPlanVersion as ToolSessionStoredOutput["recognizedPlanVersion"],
      sourcePlanVersion: raw.sourcePlanVersion as ToolSessionStoredOutput["sourcePlanVersion"],
      referencePreviewUrl:
        typeof raw.referencePreviewUrl === "string" ? raw.referencePreviewUrl : undefined
    });
  }

  if (kind === "presentation-deck" && raw.deck && typeof raw.deck === "object") {
    const deck = raw.deck as { slides?: unknown[] };
    return {
      id: typeof raw.id === "string" ? raw.id : `tool-output-${Date.now()}`,
      kind: "presentation-deck",
      label: typeof raw.label === "string" ? raw.label : "Presentation",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      slideCount: Array.isArray(deck.slides) ? deck.slides.length : 0
    };
  }

  if (kind === "image-brief" && Array.isArray(raw.briefs)) {
    return {
      id: typeof raw.id === "string" ? raw.id : `tool-output-${Date.now()}`,
      kind: "image-brief",
      label: typeof raw.label === "string" ? raw.label : "Image brief",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      briefCount: raw.briefs.length
    };
  }

  if (kind === "file-export") {
    return {
      id: typeof raw.id === "string" ? raw.id : `tool-output-${Date.now()}`,
      kind: "file-export",
      label: typeof raw.label === "string" ? raw.label : "Export",
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
      fileName: typeof raw.fileName === "string" ? raw.fileName : "export.bin",
      mimeType: typeof raw.mimeType === "string" ? raw.mimeType : "application/octet-stream"
    };
  }

  return undefined;
}

function normalizeStoredRecord(raw: unknown): ToolSessionStoredRecord {
  if (!raw || typeof raw !== "object" || !("id" in raw) || !("toolId" in raw)) {
    throw new Error("Invalid stored tool session record.");
  }

  const record = raw as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title : "Untitled session";
  const outputsRaw = record.outputs;
  let outputs: ToolSessionStoredOutput[] = [];

  if (Array.isArray(outputsRaw)) {
    outputs = outputsRaw
      .map((output) =>
        isStoredOutput(output)
          ? {
              ...output,
              referencePreviewUrl: stripInlineDataUrl(output.referencePreviewUrl)
            }
          : normalizeLegacyOutput(output as Record<string, unknown>)
      )
      .filter((output): output is ToolSessionStoredOutput => Boolean(output));
  } else if (outputsRaw && typeof outputsRaw === "object") {
    const legacy = normalizeLegacyOutput(outputsRaw as Record<string, unknown>);
    outputs = legacy ? [legacy] : [];
  }

  return {
    id: String(record.id),
    toolId: record.toolId as ToolSessionStoredRecord["toolId"],
    title,
    inputFiles: Array.isArray(record.inputFiles)
      ? record.inputFiles.map((file) => sanitizeInputFile(file as ToolSessionInputFile))
      : undefined,
    parameters:
      record.parameters && typeof record.parameters === "object"
        ? (record.parameters as ToolSessionStoredRecord["parameters"])
        : undefined,
    outputs,
    analysisMeta:
      record.analysisMeta && typeof record.analysisMeta === "object"
        ? (record.analysisMeta as ToolSessionStoredRecord["analysisMeta"])
        : undefined,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    canPromoteToProject: Boolean(record.canPromoteToProject),
    linkedProjectId: typeof record.linkedProjectId === "string" ? record.linkedProjectId : undefined,
    status:
      record.status === "draft" || record.status === "ready" || record.status === "promoted"
        ? record.status
        : "draft"
  };
}

export function toStoredMap(sessions: Record<string, ToolSessionDetail>): ToolSessionStoredMap {
  return Object.fromEntries(Object.entries(sessions).map(([id, session]) => [id, toStoredSession(session)]));
}

export function fromStoredMap(stored: ToolSessionStoredMap): Record<string, ToolSessionDetail> {
  return Object.fromEntries(
    Object.entries(stored).map(([id, record]) => [id, fromStoredSession(normalizeStoredRecord(record))])
  );
}

/** Accept legacy full sessions or stored records and return detail safe for memory use. */
export function hydrateStoredRecord(raw: unknown): ToolSessionDetail {
  try {
    return fromStoredSession(normalizeStoredRecord(raw));
  } catch {
    return fromStoredSession(toStoredSession(normalizeToolSession(raw as ToolSessionDetail)));
  }
}
