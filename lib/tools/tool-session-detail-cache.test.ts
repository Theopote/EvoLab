import { describe, expect, it } from "vitest";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";
import { extractDetailCache, mergeDetailCache } from "@/lib/tools/tool-session-detail-cache";
import { createDemoProjectData } from "@/lib/typologies";

const sourceVersion = createDemoProjectData("healthcare").versions[0]!;

describe("tool session detail cache", () => {
  it("extracts inline preview payloads for IndexedDB storage", () => {
    const session: ToolSessionDetail = {
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      canPromoteToProject: true,
      status: "ready",
      inputFiles: [
        {
          fileName: "scan.pdf",
          sourceType: "pdf",
          previewUrl: "data:image/png;base64,abc"
        }
      ],
      outputs: [
        {
          id: "output-1",
          kind: "plan-version",
          label: "scan.pdf",
          createdAt: "2026-06-26T00:00:00.000Z",
          planVersion: sourceVersion,
          referencePreviewUrl: "data:image/png;base64,abc"
        }
      ]
    };

    const cache = extractDetailCache(session);

    expect(cache?.sessionId).toBe("session-1");
    expect(cache?.inputFilePreviews).toEqual(["data:image/png;base64,abc"]);
    expect(cache?.outputs[0]?.referencePreviewUrl).toBe("data:image/png;base64,abc");
  });

  it("ignores external preview URLs because localStorage already keeps them", () => {
    const session: ToolSessionDetail = {
      id: "session-2",
      toolId: "trace-to-cad",
      title: "scan.pdf",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      canPromoteToProject: false,
      status: "draft",
      outputs: [
        {
          id: "output-1",
          kind: "plan-version",
          label: "scan.pdf",
          createdAt: "2026-06-26T00:00:00.000Z",
          planVersion: sourceVersion,
          referencePreviewUrl: "https://cdn.example.com/preview.png"
        }
      ]
    };

    expect(extractDetailCache(session)).toBeUndefined();
  });

  it("merges cached heavy payloads back into a lightweight session", () => {
    const lightSession: ToolSessionDetail = {
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      canPromoteToProject: true,
      status: "ready",
      inputFiles: [{ fileName: "scan.pdf", sourceType: "pdf" }],
      outputs: [
        {
          id: "output-1",
          kind: "plan-version",
          label: "scan.pdf",
          createdAt: "2026-06-26T00:00:00.000Z",
          planVersion: sourceVersion
        }
      ]
    };

    const restored = mergeDetailCache(lightSession, {
      sessionId: "session-1",
      updatedAt: "2026-06-26T00:00:00.000Z",
      inputFilePreviews: ["data:image/png;base64,abc"],
      outputs: [{ id: "output-1", referencePreviewUrl: "data:image/png;base64,abc" }]
    });

    expect(restored.inputFiles?.[0]?.previewUrl).toBe("data:image/png;base64,abc");
    expect(
      restored.outputs[0]?.kind === "plan-version" ? restored.outputs[0]?.referencePreviewUrl : undefined
    ).toBe("data:image/png;base64,abc");
  });
});
