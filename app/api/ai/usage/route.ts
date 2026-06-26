import { NextResponse } from "next/server";
import { getLlmUsageSummary, logLlmUsage } from "@/lib/ai/token-usage";
import { listPromptTemplates } from "@/lib/prompts/registry";

export async function GET() {
  return NextResponse.json({
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
    return NextResponse.json({ error: "task is required." }, { status: 400 });
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

  return NextResponse.json({ ok: true });
}
