import { apiError, apiOk } from "@/lib/server/api-response";
import type { ConvertToProjectRequest, ConvertToProjectResponse } from "@/lib/import-types";
import { z } from "zod";

const ConvertToProjectRequestSchema = z.object({
  sessionId: z.string().min(1),
  projectName: z.string().min(1).max(200),
  projectType: z.string().min(1).max(100),
  applyTrace: z.boolean()
});

/**
 * Convert traced elements to EvoLab project format
 * Transforms normalized coordinates to world coordinates
 */
export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = ConvertToProjectRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid convert request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data;

  try {
    // In production, retrieve session from storage
    // For now, return a basic structure that demonstrates the conversion

    if (!body.applyTrace) {
      // Just return empty outline if user wants to start from scratch
      const response: ConvertToProjectResponse = {
        outline: [],
        success: true
      };
      return apiOk(response);
    }

    // Mock: convert traced elements to project format
    // In production, this would:
    // 1. Load the session with calibration and trace data
    // 2. Transform normalized coordinates using calibration
    // 3. Convert traced elements to PlanVersion format
    // 4. Return outline and optionally rooms

    const response: ConvertToProjectResponse = {
      outline: [
        [0, 0],
        [10000, 0],
        [10000, 8000],
        [0, 8000]
      ], // Mock outline in mm
      rooms: [
        {
          polygon: [[1000, 1000], [5000, 1000], [5000, 4000], [1000, 4000]],
          label: "Space 1"
        },
        {
          polygon: [[5000, 1000], [9000, 1000], [9000, 4000], [5000, 4000]],
          label: "Space 2"
        }
      ],
      success: true
    };

    return apiOk(response);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert to project.";
    return apiError(message, 500, "CONVERT_FAILED");
  }
}
