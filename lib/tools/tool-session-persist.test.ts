import { describe, expect, it } from "vitest";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";
import {
  fromStoredOutput,
  fromStoredSession,
  isInlineDataUrl,
  stripInlineDataUrl,
  toStoredOutput,
  toStoredSession
} from "@/lib/tools/tool-session-persist";
import { createDemoProjectData } from "@/lib/typologies";

const sourceVersion = createDemoProjectData("healthcare").versions[0]!;

describe("tool session persist", () => {
  it("detects inline data URLs", () => {
    expect(isInlineDataUrl("data:image/png;base64,abc")).toBe(true);
    expect(isInlineDataUrl("https://cdn.example.com/preview.png")).toBe(false);
  });

  it("strips inline data URLs before persistence", () => {
    expect(stripInlineDataUrl("data:image/png;base64,abc")).toBeUndefined();
    expect(stripInlineDataUrl("https://cdn.example.com/preview.png")).toBe(
      "https://cdn.example.com/preview.png"
    );
  });

  it("stores plan-version outputs without inline preview URLs", () => {
    const stored = toStoredOutput({
      id: "output-1",
      kind: "plan-version",
      label: "scan.pdf",
      createdAt: "2026-06-26T00:00:00.000Z",
      planVersion: sourceVersion,
      referencePreviewUrl: "data:image/png;base64,abc"
    });

    expect(stored.referencePreviewUrl).toBeUndefined();
    expect(stored.planVersion).toEqual(sourceVersion);
  });

  it("stores file-export outputs without dataUrl payloads", () => {
    const stored = toStoredOutput({
      id: "output-2",
      kind: "file-export",
      label: "export.dxf",
      createdAt: "2026-06-26T00:00:00.000Z",
      fileName: "export.dxf",
      mimeType: "application/dxf",
      dataUrl: "data:application/octet-stream;base64,abc"
    });

    expect(stored).toEqual({
      id: "output-2",
      kind: "file-export",
      label: "export.dxf",
      createdAt: "2026-06-26T00:00:00.000Z",
      fileName: "export.dxf",
      mimeType: "application/dxf"
    });
  });

  it("stores presentation decks as lightweight slide counts", () => {
    const stored = toStoredOutput({
      id: "output-3",
      kind: "presentation-deck",
      label: "汇报稿",
      createdAt: "2026-06-26T00:00:00.000Z",
      deck: {
        projectName: "Demo",
        projectType: "office",
        versionLabel: "V1",
        generatedAt: "2026-06-26T00:00:00.000Z",
        slides: [{ id: "s1", kind: "cover", title: "Cover", bullets: [] }]
      }
    });

    expect(stored.slideCount).toBe(1);
    expect("deck" in stored).toBe(false);
  });

  it("round-trips a stored session without heavy payloads", () => {
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
          previewUrl: "data:image/png;base64,abc",
          sizeBytes: 4096
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

    const stored = toStoredSession(session);
    expect(stored.inputFiles?.[0]?.previewUrl).toBeUndefined();
    expect(stored.inputFiles?.[0]?.sizeBytes).toBe(4096);
    expect(stored.outputs[0]?.referencePreviewUrl).toBeUndefined();

    const restored = fromStoredSession(stored);
    expect(restored.inputFiles?.[0]?.previewUrl).toBeUndefined();
    expect(getPlanVersionOutput(restored)?.referencePreviewUrl).toBeUndefined();
    expect(getPlanVersionOutput(restored)?.planVersion).toEqual(sourceVersion);
  });

  it("restores stored presentation output as an empty deck shell", () => {
    const output = fromStoredOutput({
      id: "output-3",
      kind: "presentation-deck",
      label: "汇报稿",
      createdAt: "2026-06-26T00:00:00.000Z",
      slideCount: 3
    });

    expect(output.kind).toBe("presentation-deck");
    if (output.kind === "presentation-deck") {
      expect(output.deck.slides).toEqual([]);
    }
  });
});

function getPlanVersionOutput(session: ToolSessionDetail | undefined) {
  return session?.outputs.find((output) => output.kind === "plan-version");
}
