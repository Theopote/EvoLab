import { describe, expect, it } from "vitest";
import { ApiClientError, readApiBlob, readApiResponse } from "@/lib/api-client";

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

  it("reads binary payloads after a successful response", async () => {
    const response = new Response(new Blob(["pdf-bytes"]), {
      status: 200,
      headers: { "Content-Type": "application/pdf" }
    });

    await expect(readApiBlob(response)).resolves.toBeInstanceOf(Blob);
  });

  it("throws ApiClientError for failed blob responses with envelope", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        error: { code: "PDF_EXPORT_UNAVAILABLE", message: "Chromium missing." }
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" }
      }
    );

    await expect(readApiBlob(response)).rejects.toBeInstanceOf(ApiClientError);
  });
});
