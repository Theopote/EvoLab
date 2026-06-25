import type { PlanVersion, Point } from "@/lib/project-types";
import type { BuildableEnvelope } from "@/lib/site-types";

export async function relayoutPlanCommand(input: {
  version: PlanVersion;
  outline: Point[];
  layoutOutline: Point[];
}): Promise<PlanVersion> {
  const response = await fetch("/api/relayout-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `relayout-plan failed with ${response.status}`);
  }

  const data = (await response.json()) as { version?: PlanVersion };

  if (!data.version) {
    throw new Error("relayout-plan did not return a version.");
  }

  return data.version;
}

export function resolveRelayoutOutline(outline: Point[], buildableEnvelope?: BuildableEnvelope): Point[] {
  return buildableEnvelope?.valid ? buildableEnvelope.footprint : outline;
}
