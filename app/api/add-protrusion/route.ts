import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { hasAnthropicKey } from "@/lib/anthropic-json";
import { buildProtrusionPreviewVersion, mockProtrusionFromWall } from "@/lib/local-form-edit";
import { addProtrusionPrompt } from "@/lib/prompts/addProtrusionPrompt";
import { AddProtrusionToolInputSchema } from "@/lib/schemas/local-form-edit-schema";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { CopilotFinding, PlanVersion, RoomProtrusion, Wall } from "@/lib/project-types";
import type { ScoringConfig } from "@/lib/building-domain";

interface AddProtrusionRequest {
  currentVersion?: PlanVersion;
  roomId?: string;
  wall?: Wall;
  positionOnEdge?: number;
  widthM?: number;
  userRequest?: string;
  levelId?: string;
  scoringConfig?: ScoringConfig;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AddProtrusionRequest;

  if (!body.currentVersion) {
    return apiError("currentVersion is required.", 400, "INVALID_PAYLOAD");
  }

  if (!body.roomId || !body.wall) {
    return apiError("roomId and wall are required.", 400, "INVALID_PAYLOAD");
  }

  if (!body.userRequest?.trim()) {
    return apiError("userRequest is required.", 400, "INVALID_PAYLOAD");
  }

  const positionOnEdge = body.positionOnEdge ?? 0.5;
  const widthM = body.widthM ?? 1.5;
  let protrusion: RoomProtrusion | undefined = mockProtrusionFromWall(
    body.wall,
    positionOnEdge,
    widthM,
    body.userRequest,
    body.currentVersion.rooms.find((room) => room.id === body.roomId)?.polygon
  );
  let warning: string | undefined;
  let findings: CopilotFinding[] = [];

  if (!protrusion) {
    return apiError("Could not build a protrusion footprint on the selected wall.", 400, "PROTRUSION_FAILED");
  }

  if (hasAnthropicKey()) {
    try {
      const edgeLength = Math.hypot(
        body.wall.end[0] - body.wall.start[0],
        body.wall.end[1] - body.wall.start[1]
      );
      const data = await requestAnthropicTool({
        system: addProtrusionPrompt,
        input: {
          roomId: body.roomId,
          wall: body.wall,
          edgeLength,
          positionOnEdge,
          widthM,
          userRequest: body.userRequest,
          siteOutline: body.currentVersion.outline
        },
        toolName: "add_protrusion",
        toolDescription: "Return a protrusion footprint polygon and metadata.",
        schema: AddProtrusionToolInputSchema
      });

      protrusion = {
        id: `protrusion-${Date.now()}`,
        ...data.protrusion,
        widthM,
        positionOnEdge
      };
      findings = data.findings ?? [];
    } catch (error) {
      warning = error instanceof Error ? error.message : "add-protrusion fell back to local footprint.";
      protrusion = mockProtrusionFromWall(
        body.wall,
        positionOnEdge,
        widthM,
        body.userRequest,
        body.currentVersion.rooms.find((room) => room.id === body.roomId)?.polygon
      );
    }
  } else {
    warning = "ANTHROPIC_API_KEY is not configured. Using local bay-window footprint.";
  }

  if (!protrusion) {
    return apiError("Protrusion generation failed.", 400, "PROTRUSION_FAILED");
  }

  try {
    const preview = buildProtrusionPreviewVersion(body.currentVersion, body.roomId, protrusion, {
      levelId: body.levelId,
      scoringConfig: body.scoringConfig
    });

    return apiOk({
      protrusion,
      findings,
      warning,
      gfaBasis: preview.gfaBasis,
      version: preview.version
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Failed to add protrusion.", 400, "PROTRUSION_FAILED");
  }
}
