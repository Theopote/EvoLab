import { readApiResponse } from "@/lib/api-client";
import type { SiteContext } from "@/lib/site-types";

export async function fetchSiteContextCommand(address: string): Promise<{
  context: SiteContext;
  warning?: string;
}> {
  const response = await fetch("/api/fetch-site-context", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address })
  });

  const data = await readApiResponse<{ context?: SiteContext; warning?: string }>(response);

  if (!data.context) {
    throw new Error("Site context response was empty.");
  }

  return { context: data.context, warning: data.warning };
}
