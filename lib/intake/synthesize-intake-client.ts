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

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `synthesize-intake failed with ${response.status}`);
  }

  return (await response.json()) as ProjectIntakeRecord & { fallback?: boolean };
}
