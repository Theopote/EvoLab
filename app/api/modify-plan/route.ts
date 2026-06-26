import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { formatCopilotFallbackWarning } from "@/lib/copilot-supported-operations";
import { normalizeImageInputs } from "@/lib/image-input";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import { DEFAULT_PROMPT_REFS, resolvePrompt } from "@/lib/prompts/registry";
import { ProposePlanChangesToolInputSchema } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

export type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

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
  const body = (await request.json().catch(() => ({}))) as ModifyPlanRequest;

  if (!body.currentVersion) {
    return NextResponse.json(
      { error: "currentVersion is required for modify-plan." },
      { status: 400 }
    );
  }

  if (body.stream) {
    return streamModifyPlan(body);
  }

  try {
    const result = await runModifyPlan(body);

    if (result) {
      return NextResponse.json(result);
    }
  } catch {
    // Fall through to deterministic mock proposal.
  }

  return NextResponse.json(buildFallbackResponse(body));
}
