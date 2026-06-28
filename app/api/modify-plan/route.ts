import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { apiError, apiOk } from "@/lib/server/api-response";
import { formatCopilotFallbackWarning } from "@/lib/copilot-supported-operations";
import { normalizeImageInputs } from "@/lib/image-input";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import { DEFAULT_PROMPT_REFS, resolvePrompt } from "@/lib/prompts/registry";
import { ProposePlanChangesToolInputSchema } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import { z } from "zod";

export type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

const ModifyPlanRequestSchema = z.object({
  currentVersion: z.object({}).passthrough(), // PlanVersion schema
  userRequest: z.string().min(1).max(2000),
  lockedElementIds: z.array(z.string()).optional(),
  referenceImages: z.array(
    z.object({
      base64: z.string(),
      mediaType: z.string().optional(),
      fileName: z.string().optional()
    })
  ).max(5).optional(), // Limit to 5 images
  stream: z.boolean().optional()
});

interface ModifyPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
  lockedElementIds?: string[];
  referenceImages?: Array<{ base64: string; mediaType?: string; fileName?: string }>;
  stream?: boolean;
}

function buildModifyPlanInput(body: ModifyPlanRequest, referenceImages: ReturnType<typeof normalizeImageInputs>) {
  return {
    currentVersion: body.currentVersion,
    userRequest: body.userRequest,
    lockedElementIds: body.lockedElementIds ?? [],
    referenceImageCount: referenceImages.length,
    referenceImageNames: referenceImages.map((image) => image.fileName).filter(Boolean)
  };
}

async function runModifyPlan(body: ModifyPlanRequest, onStreamDelta?: (text: string) => void) {
  const referenceImages = normalizeImageInputs(body.referenceImages);
  const toolInput = buildModifyPlanInput(body, referenceImages);

  const proposalData = await requestAnthropicTool({
    system: resolvePrompt(DEFAULT_PROMPT_REFS.copilotModify),
    input: toolInput,
    images: referenceImages.map((image) => ({
      base64: image.base64,
      mediaType: image.mediaType
    })),
    toolName: "propose_plan_changes",
    toolDescription:
      "Return a structured PlanChangeProposal with intent, constraints, and geometry operations.",
    schema: ProposePlanChangesToolInputSchema,
    maxTokens: 4096,
    task: "copilot-modify",
    route: "/api/modify-plan",
    promptRef: DEFAULT_PROMPT_REFS.copilotModify,
    onStreamDelta
  });

  if (!proposalData.proposal?.operations?.length || !body.currentVersion) {
    return null;
  }

  const version = buildPreviewVersion(body.currentVersion, proposalData.proposal, {
    lockedElementIds: body.lockedElementIds
  });

  return {
    mode: "proposal" as const,
    proposal: proposalData.proposal,
    version,
    findings: proposalData.findings ?? []
  } satisfies ModifyPlanResponse;
}

function buildFallbackResponse(body: ModifyPlanRequest): ModifyPlanResponse {
  const fallback = createMockModifiedVersion(body.currentVersion!, body.userRequest ?? "");
  return {
    ...fallback,
    fallback: true,
    warning: fallback.warning ?? formatCopilotFallbackWarning()
  };
}

function streamModifyPlan(body: ModifyPlanRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("status", { message: "正在分析当前方案与约束…" });

      try {
        const result = await runModifyPlan(body, (text) => {
          send("delta", { text });
        });

        if (result) {
          send("result", result);
        } else {
          send("result", buildFallbackResponse(body));
        }
      } catch {
        send("result", buildFallbackResponse(body));
      }

      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = ModifyPlanRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid modify-plan request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as ModifyPlanRequest;

  if (!body.currentVersion) {
    return apiError("currentVersion is required for modify-plan.", 400, "INVALID_PAYLOAD");
  }

  if (body.stream) {
    return streamModifyPlan(body);
  }

  try {
    const result = await runModifyPlan(body);

    if (result) {
      return apiOk(result);
    }
  } catch {
    // Fall through to deterministic mock proposal.
  }

  return apiOk(buildFallbackResponse(body));
}
