import { describe, expect, it } from "vitest";
import { ApiClientError, readApiResponse } from "@/lib/api-client";

describe("api-client", () => {
  it("unwraps successful envelope payloads", async () => {
    const response = new Response(JSON.stringify({ success: true, data: { projects: [] } }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    await expect(readApiResponse<{ projects: unknown[] }>(response)).resolves.toEqual({ projects: [] });
  });

  it("throws ApiClientError for failed envelope payloads", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        error: { code: "NOT_FOUND", message: "Project not found." }
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" }
      }
    );

    await expect(readApiResponse(response)).rejects.toBeInstanceOf(ApiClientError);
  });

  it("supports legacy raw payloads during migration", async () => {
    const response = new Response(JSON.stringify({ projects: [{ projectId: "demo" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

    await expect(readApiResponse<{ projects: Array<{ projectId: string }> }>(response)).resolves.toEqual({
      projects: [{ projectId: "demo" }]
    });
  });
});
