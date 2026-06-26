import { readApiResponse } from "@/lib/api-client";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

interface ModifyPlanRequestBody {
  currentVersion: unknown;
  userRequest: string;
  lockedElementIds?: string[];
  allVersions?: unknown[];
  referenceImages?: Array<{ base64: string; mediaType?: string; fileName?: string }>;
}

function parseSseChunk(buffer: string) {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = buffer.split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    const lines = block.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLine = lines.find((line) => line.startsWith("data:"));

    if (!eventLine || !dataLine) {
      continue;
    }

    events.push({
      event: eventLine.slice(6).trim(),
      data: dataLine.slice(5).trim()
    });
  }

  return events;
}

export async function requestModifyPlan(
  body: ModifyPlanRequestBody,
  options?: {
    onStatus?: (message: string) => void;
    onDelta?: (text: string) => void;
  }
): Promise<ModifyPlanResponse> {
  const response = await fetch("/api/modify-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      stream: Boolean(options?.onDelta || options?.onStatus)
    })
  });

  if (!response.ok && !options?.onDelta && !options?.onStatus) {
    await readApiResponse<ModifyPlanResponse>(response);
  }

  if (!options?.onDelta && !options?.onStatus) {
    return readApiResponse<ModifyPlanResponse>(response);
  }

  const reader = response.body?.getReader();

  if (!reader) {
    return readApiResponse<ModifyPlanResponse>(response);
  }

  const decoder = new TextDecoder();
  let pending = "";
  let result: ModifyPlanResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    pending += decoder.decode(value, { stream: true });
    const events = parseSseChunk(pending);
    const lastBlockIndex = pending.lastIndexOf("\n\n");

    if (lastBlockIndex >= 0) {
      pending = pending.slice(lastBlockIndex + 2);
    }

    for (const event of events) {
      if (event.event === "status") {
        const payload = JSON.parse(event.data) as { message?: string };
        if (payload.message) {
          options.onStatus?.(payload.message);
        }
      }

      if (event.event === "delta") {
        const payload = JSON.parse(event.data) as { text?: string };
        if (payload.text) {
          options.onDelta?.(payload.text);
        }
      }

      if (event.event === "result") {
        result = JSON.parse(event.data) as ModifyPlanResponse;
      }
    }
  }

  if (!result) {
    throw new Error("modify-plan stream ended without a result.");
  }

  return result;
}
