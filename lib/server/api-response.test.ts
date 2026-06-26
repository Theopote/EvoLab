import { describe, expect, it } from "vitest";
import { apiError, apiOk, isApiResponse } from "@/lib/server/api-response";

describe("api-response", () => {
  it("wraps successful payloads", async () => {
    const response = apiOk({ projectId: "demo" });
    const payload = await response.json();

    expect(payload).toEqual({
      success: true,
      data: { projectId: "demo" }
    });
  });

  it("wraps error payloads with code and message", async () => {
    const response = apiError("Invalid payload.", 400, "INVALID_PAYLOAD", "missing projectId");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload.",
        details: "missing projectId"
      }
    });
  });

  it("detects envelope-shaped payloads", () => {
    expect(isApiResponse({ success: true, data: {} })).toBe(true);
    expect(isApiResponse({ success: false, error: { code: "X", message: "Y" } })).toBe(true);
    expect(isApiResponse({ projects: [] })).toBe(false);
  });
});
