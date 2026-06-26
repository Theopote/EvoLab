import { readApiResponse } from "@/lib/api-client";
import type { IntakeMaterialInput } from "@/lib/intake/mock-intake-synthesis";
import type { ProjectIntakeRecord } from "@/lib/intake/project-intake-types";

export async function synthesizeIntakeClient(input: {
  projectName?: string;
  materials: IntakeMaterialInput[];
}): Promise<ProjectIntakeRecord & { fallback?: boolean }> {
  const response = await fetch("/api/synthesize-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  return readApiResponse<ProjectIntakeRecord & { fallback?: boolean }>(response);
}
