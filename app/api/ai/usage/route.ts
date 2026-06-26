import { getLlmUsageSummary, logLlmUsage } from "@/lib/ai/token-usage";
import { listPromptTemplates } from "@/lib/prompts/registry";
import { apiError, apiOk } from "@/lib/server/api-response";

export async function GET() {
  return apiOk({
    usage: getLlmUsageSummary(),
    prompts: listPromptTemplates()
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    provider?: string;
    model?: string;
    task?: string;
    route?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheHit?: boolean;
  } | null;

  if (!body?.task) {
    return apiError("task is required.", 400, "INVALID_PAYLOAD");
  }

  await logLlmUsage({
    provider: (body.provider as "anthropic") ?? "anthropic",
    model: body.model ?? "unknown",
    task: body.task as never,
    route: body.route,
    inputTokens: body.inputTokens ?? 0,
    outputTokens: body.outputTokens ?? 0,
    cacheHit: body.cacheHit ?? false
  });

  return apiOk({ logged: true });
}
