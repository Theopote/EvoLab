import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { geometryValidationPassed, detectGapsAndOverlaps } from "@/lib/geometry-validate";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { hybridizeSchemesPrompt } from "@/lib/prompts/hybridizeSchemesPrompt";
import { mergeHybridRooms } from "@/lib/hybridize-merge";
import { resolveAllVersionRooms } from "@/lib/level-rooms";
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
  return resolveAllVersionRooms(version).filter((room) => allowed.has(room.id));
}

function mergeHybridResult(
  versionA: PlanVersion,
  versionB: PlanVersion,
  aiVersion: PlanVersion,
  keptFromA: string[],
  keptFromB: string[],
  priority: "A" | "B"
) {
  const mergedRooms = mergeHybridRooms(versionA, versionB, aiVersion, keptFromA, keptFromB, priority);
  const baseVersion = priority === "B" ? versionB : versionA;

  return normalizePlanVersion({
    ...aiVersion,
    rooms: mergedRooms,
    outline: baseVersion.outline,
    overallBounds: baseVersion.overallBounds,
    levels: baseVersion.levels,
    building: baseVersion.building,
    standardFloorGroups: baseVersion.standardFloorGroups
  });
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
  const priority = body.priority ?? "A";
  const baseVersion = priority === "B" ? body.versionB : body.versionA;

  const userRequest = `Hybridize schemes by keeping selected regions fixed and filling the remaining outline.

【Fixed region from scheme A】${JSON.stringify(lockedA.map((room) => ({ id: room.id, name: room.name, polygon: room.polygon })))}
【Fixed region from scheme B】${JSON.stringify(lockedB.map((room) => ({ id: room.id, name: room.name, polygon: room.polygon })))}
Outline: ${JSON.stringify(body.outline ?? baseVersion.outline)}
If regions overlap, prioritize scheme ${priority}.

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

    let merged = mergeHybridResult(
      body.versionA,
      body.versionB,
      postProcessPlanVersion(aiResult.version),
      body.keptFromA.roomIds,
      body.keptFromB.roomIds,
      priority
    );
    const geometryIssues = detectGapsAndOverlaps(merged.outline, merged.rooms);

    if (!geometryValidationPassed(merged.outline, merged.rooms)) {
      const fallback = createMockModifiedVersion(baseVersion, "Hybrid fill between fixed regions");
      merged = mergeHybridResult(
        body.versionA,
        body.versionB,
        fallback.version,
        body.keptFromA.roomIds,
        body.keptFromB.roomIds,
        priority
      );
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
    const merged = mergeHybridResult(
      body.versionA,
      body.versionB,
      fallback.version,
      body.keptFromA.roomIds,
      body.keptFromB.roomIds,
      priority
    );

    return NextResponse.json({
      version: merged,
      fallback: true,
      warning: error instanceof Error ? error.message : "Hybridize failed; returned deterministic fallback.",
      lockedRoomIds: [...lockedRoomIds],
      geometryValid: geometryValidationPassed(merged.outline, merged.rooms)
    });
  }
}
