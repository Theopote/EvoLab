import { describe, expect, it } from "vitest";
import { legacyTabAlias, normalizeWorkspaceTab } from "@/lib/workflow-navigation";

describe("plan-import-client", () => {
  it("keeps legacy tab aliases for copilot navigation after import", () => {
    expect(legacyTabAlias.Sheets).toBe("Presentation");
    expect(normalizeWorkspaceTab("Sheets")).toBe("Presentation");
  });
});
