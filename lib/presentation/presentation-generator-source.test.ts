import { describe, expect, it } from "vitest";
import {
  createPresentationProjectFromVersion,
  defaultStoryArcFromDeck,
  presentationSourceFromDemo,
  presentationSourceFromToolSession
} from "@/lib/presentation/presentation-generator-source";
import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { createDemoProjectData } from "@/lib/typologies";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";

describe("presentation generator source", () => {
  it("builds a deck from demo healthcare source", () => {
    const source = presentationSourceFromDemo("healthcare");
    const deck = buildPresentationDeck({
      project: source.project,
      version: source.version,
      compareVersionIds: source.compareVersionIds
    });

    expect(deck.slides.length).toBeGreaterThan(4);
    expect(defaultStoryArcFromDeck(deck.slides).length).toBe(deck.slides.length);
  });

  it("wraps tool session plan versions for presentation", () => {
    const version = createDemoProjectData("office").versions[0]!;
    const session: ToolSessionDetail = {
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf · 扫描转 CAD",
      createdAt: "2026-06-27T00:00:00.000Z",
      updatedAt: "2026-06-27T00:00:00.000Z",
      outputs: [
        {
          id: "output-1",
          kind: "plan-version",
          label: "scan.pdf",
          createdAt: "2026-06-27T00:00:00.000Z",
          planVersion: version
        }
      ],
      canPromoteToProject: true,
      status: "ready"
    };

    const source = presentationSourceFromToolSession(session);
    expect(source?.version.id).toBe(version.id);
    expect(createPresentationProjectFromVersion({
      projectName: "scan.pdf",
      version
    }).projectName).toBe("scan.pdf");
  });
});
