import { describe, expect, it, vi, beforeEach } from "vitest";
import { listRecentProjects, recordProjectAccess, readProjectRegistry } from "@/lib/project-registry";

describe("project registry", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn()
      }
    });
  });

  it("records recent project access", () => {
    recordProjectAccess({
      projectId: "demo-1",
      projectName: "Demo Project",
      projectType: "office",
      versions: [{ id: "v1" } as never]
    });

    expect(window.localStorage.setItem).toHaveBeenCalled();
    const payload = JSON.parse(String((window.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]));
    expect(payload[0]).toMatchObject({
      projectId: "demo-1",
      projectName: "Demo Project",
      versionCount: 1
    });
  });

  it("returns empty list when storage is empty", () => {
    expect(readProjectRegistry()).toEqual([]);
    expect(listRecentProjects()).toEqual([]);
  });
});
