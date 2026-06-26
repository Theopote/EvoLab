import { readApiResponse } from "@/lib/api-client";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import type { PresentationDeck } from "@/lib/presentation/types";

export interface GenerateStoryboardResult {
  deck: PresentationDeck;
  storyArc?: string[];
  warning?: string;
  fallback?: boolean;
}

export async function generateStoryboardViaApi(input: {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
}): Promise<GenerateStoryboardResult> {
  const response = await fetch("/api/generate-storyboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project: input.project,
      version: input.version,
      brief: input.brief
    })
  });

  const data = await readApiResponse<GenerateStoryboardResult>(response);

  if (!data.deck) {
    throw new Error("No presentation deck returned.");
  }

  return data;
}
