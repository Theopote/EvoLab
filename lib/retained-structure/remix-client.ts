import { readApiResponse } from "@/lib/api-client";
import type { PlanVersion, Point } from "@/lib/project-types";
import type { ResolvedRetainedStructureRemixOptions } from "@/lib/retained-structure/remix-plan-version";

export async function remixRetainedStructureViaApi(input: {
  version: PlanVersion;
  outline: Point[];
  layoutOutline?: Point[];
  options?: Partial<ResolvedRetainedStructureRemixOptions>;
}): Promise<PlanVersion> {
  const response = await fetch("/api/remix-retained-structure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const data = await readApiResponse<{ version?: PlanVersion }>(response);

  if (!data.version) {
    throw new Error("remix-retained-structure did not return a version.");
  }

  return data.version;
}
