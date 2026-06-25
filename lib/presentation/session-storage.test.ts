import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPresentationSessions, writePresentationSessions } from "@/lib/presentation/session-storage";
import type { PresentationSessionMap } from "@/lib/presentation/session-types";

const STORAGE_KEY = "evolab.presentation.sessions";

function createSessionMap(): PresentationSessionMap {
  return {
    "version-1": {
      versionId: "version-1",
      deck: {
        projectName: "Demo",
        projectType: "office",
        versionLabel: "V1",
        generatedAt: "2026-06-25T00:00:00.000Z",
        slides: [
          {
            id: "cover",
            kind: "cover",
            title: "Cover",
            bullets: ["One"]
          }
        ]
      },
      templateId: "classic",
      activeSlideIndex: 0,
      updatedAt: "2026-06-25T00:00:00.000Z"
    }
  };
}

describe("presentation session storage", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: vi.fn(),
        setItem: vi.fn()
      }
    });
  });

  it("returns empty map when storage is empty", () => {
    window.sessionStorage.getItem = vi.fn(() => null);

    expect(readPresentationSessions()).toEqual({});
  });

  it("reads persisted sessions from sessionStorage", () => {
    const sessions = createSessionMap();
    window.sessionStorage.getItem = vi.fn(() => JSON.stringify(sessions));

    expect(readPresentationSessions()).toEqual(sessions);
  });

  it("writes sessions to sessionStorage", () => {
    const sessions = createSessionMap();
    writePresentationSessions(sessions);

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(sessions));
  });
});
