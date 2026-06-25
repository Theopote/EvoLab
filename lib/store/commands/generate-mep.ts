import type { MepLayout } from "@/lib/project-types";
import type { PlanVersion } from "@/lib/project-types";

export async function generateMepCommand(version: PlanVersion): Promise<{
  mep: MepLayout;
  warning?: string;
}> {
  const response = await fetch("/api/generate-mep", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version })
  });

  if (!response.ok) {
    throw new Error(`generate-mep failed with ${response.status}`);
  }

  const data = (await response.json()) as { mep?: MepLayout; warning?: string };

  if (!data.mep?.routes) {
    throw new Error("generate-mep did not return a MepLayout.");
  }

  return { mep: data.mep, warning: data.warning };
}
