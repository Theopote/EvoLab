import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInput } from "@/lib/image-input";
import { sketchInterpretationPrompt } from "@/lib/prompts/sketchInterpretationPrompt";
import type { ProcessedLoop } from "@/lib/sketch-processing";
import {
  buildRecognizedRoomsFromLoops,
  mergeSketchRoomsIntoVersion
} from "@/lib/sketch-to-version";
import {
  SketchInterpretationToolInputSchema,
  type RecognizedSketchRoom
} from "@/lib/schemas/sketch-interpretation-schema";
import type { PlanVersion } from "@/lib/project-types";

interface InterpretSketchRequest {
  currentVersion?: PlanVersion;
  closedLoops?: ProcessedLoop[];
  sketchImageBase64?: string;
  appendRooms?: boolean;
}

function buildFallbackRecognition(closedLoops: ProcessedLoop[]): RecognizedSketchRoom[] {
  return buildRecognizedRoomsFromLoops(
    closedLoops.map((loop, index) => ({
      polygon: loop.polygon,
      index
    }))
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as InterpretSketchRequest;

  if (!body.currentVersion) {
    return NextResponse.json({ error: "currentVersion is required for interpret-sketch." }, { status: 400 });
  }

  const closedLoops = body.closedLoops ?? [];

  if (closedLoops.length === 0) {
    return NextResponse.json({ error: "At least one closed loop is required." }, { status: 400 });
  }

  const fallbackRooms = buildFallbackRecognition(closedLoops);
  const fallbackVersion = mergeSketchRoomsIntoVersion(body.currentVersion, fallbackRooms, {
    append: body.appendRooms ?? true
  });

  try {
    const image = body.sketchImageBase64
      ? normalizeImageInput(body.sketchImageBase64, "sketch.png")
      : undefined;

    const data = await requestAnthropicTool({
      system: sketchInterpretationPrompt,
      input: {
        closedLoops: closedLoops.map((loop) => ({
          polygon: loop.polygon,
          areaSqm: loop.areaSqm
        }))
      },
      images: image ? [{ base64: image.base64, mediaType: image.mediaType }] : undefined,
      toolName: "interpret_sketch",
      toolDescription:
        "Return recognized sketch rooms with confidence levels, using cleaned geometry and sketch image cues.",
      schema: SketchInterpretationToolInputSchema,
      maxTokens: 8192
    });

    const recognizedRooms = data.recognizedRooms?.length ? data.recognizedRooms : fallbackRooms;
    const version = mergeSketchRoomsIntoVersion(body.currentVersion, recognizedRooms, {
      append: body.appendRooms ?? true
    });

    return NextResponse.json({
      version,
      recognizedRooms,
      warnings: data.warnings ?? [],
      fallback: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to interpret sketch.";

    if (/required|valid base64|too large/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      version: fallbackVersion,
      recognizedRooms: fallbackRooms,
      warnings: [message, "Returned geometry-only fallback recognition."],
      fallback: true
    });
  }
}
