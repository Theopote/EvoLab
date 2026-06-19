import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { geometryValidationPassed, detectGapsAndOverlaps } from "@/lib/geometry-validate";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { hybridizeSchemesPrompt } from "@/lib/prompts/hybridizeSchemesPrompt";
import { enforceRegionLock } from "@/lib/region-lock";
import { ModifyPlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface HybridRegion {
  sourceVersionId: string;
  roomIds: string[];
}

interface HybridizeSchemesRequest {
  outline?: PlanVersion["outline"];
  keptFromA?: HybridRegion;
  keptFromB?: HybridRegion;
  versionA?: PlanVersion;
  versionB?: PlanVersion;
  priority?: "A" | "B";
}

function roomsFromVersion(version: PlanVersion, roomIds: string[]) {
  const allowed = new Set(roomIds);
  return version.rooms.filter((room) => allowed.has(room.id));
}

function mergeHybridResult(baseVersion: PlanVersion, aiVersion: PlanVersion, lockedRoomIds: Set<string>) {
  const mergedRooms = enforceRegionLock(baseVersion.rooms, aiVersion.rooms, lockedRoomIds);
  return {
    ...aiVersion,
    rooms: mergedRooms,
    outline: baseVersion.outline,
    overallBounds: baseVersion.overallBounds
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as HybridizeSchemesRequest;

  if (!body.versionA || !body.versionB || !body.keptFromA || !body.keptFromB) {
    return NextResponse.json(
      { error: "versionA, versionB, keptFromA, and keptFromB are required." },
      { status: 400 }
    );
  }

  const lockedA = roomsFromVersion(body.versionA, body.keptFromA.roomIds);
  const lockedB = roomsFromVersion(body.versionB, body.keptFromB.roomIds);
  const lockedRoomIds = new Set([...lockedA, ...lockedB].map((room) => room.id));
  const baseVersion = body.priority === "B" ? body.versionB : body.versionA;

  const userRequest = `Hybridize schemes by keeping selected regions fixed and filling the remaining outline.

【Fixed region from scheme A】${JSON.stringify(lockedA.map((room) => ({ id: room.id, name: room.name, polygon: room.polygon })))}
【Fixed region from scheme B】${JSON.stringify(lockedB.map((room) => ({ id: room.id, name: room.name, polygon: room.polygon })))}
Outline: ${JSON.stringify(body.outline ?? baseVersion.outline)}
If regions overlap, prioritize scheme ${body.priority ?? "A"}.

Fill remaining space with a coherent layout. Keep fixed room polygons unchanged.`;

  try {
    const aiResult = await requestAnthropicTool({
      system: hybridizeSchemesPrompt,
      input: {
        currentVersion: baseVersion,
        userRequest,
        lockedRoomIds: [...lockedRoomIds]
      },
      toolName: "hybridize_schemes",
      toolDescription: "Return a merged PlanVersion with fixed regions preserved and remaining outline filled.",
      schema: ModifyPlanToolInputSchema,
      maxTokens: 8192,
      maxValidationRetries: 1
    });

    let merged = mergeHybridResult(baseVersion, postProcessPlanVersion(aiResult.version), lockedRoomIds);
    const geometryIssues = detectGapsAndOverlaps(merged.outline, merged.rooms);

    if (!geometryValidationPassed(merged.outline, merged.rooms)) {
      const fallback = createMockModifiedVersion(baseVersion, "Hybrid fill between fixed regions");
      merged = mergeHybridResult(baseVersion, fallback.version, lockedRoomIds);
    }

    const findings: CopilotFinding[] = [
      ...(aiResult.findings ?? []),
      ...geometryIssues.map((issue, index) => ({
        id: `hybrid-geometry-${index}`,
        tone: issue.kind === "overlap" ? ("warning" as const) : ("info" as const),
        text: issue.message,
        sub: "Geometry validator"
      }))
    ];

    return NextResponse.json({
      version: merged,
      findings,
      lockedRoomIds: [...lockedRoomIds],
      geometryValid: geometryValidationPassed(merged.outline, merged.rooms)
    });
  } catch (error) {
    const fallback = createMockModifiedVersion(baseVersion, "Hybrid fill between fixed regions");
    const merged = mergeHybridResult(baseVersion, fallback.version, lockedRoomIds);

    return NextResponse.json({
      version: merged,
      fallback: true,
      warning: error instanceof Error ? error.message : "Hybridize failed; returned deterministic fallback.",
      lockedRoomIds: [...lockedRoomIds],
      geometryValid: geometryValidationPassed(merged.outline, merged.rooms)
    });
  }
}
