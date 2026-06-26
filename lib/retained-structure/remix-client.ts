import type { PlanVersion, Point } from "@/lib/project-types";
import type { RetainedStructureRemixOptions } from "@/lib/retained-structure/remix-plan-version";

export async function remixRetainedStructureViaApi(input: {
  version: PlanVersion;
  outline: Point[];
  layoutOutline?: Point[];
  options?: Pick<RetainedStructureRemixOptions, "preserveColumns" | "preserveCores">;
}): Promise<PlanVersion> {
  const response = await fetch("/api/remix-retained-structure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `remix-retained-structure failed with ${response.status}`);
  }

  const data = (await response.json()) as { version?: PlanVersion };

  if (!data.version) {
    throw new Error("remix-retained-structure did not return a version.");
  }

  return data.version;
}
