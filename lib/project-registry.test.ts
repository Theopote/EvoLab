import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listRecentProjects,
  mergeProjectSummaries,
  recordProjectAccess,
  readProjectRegistry,
  removeProjectFromRegistry,
  type ProjectRegistryEntry
} from "@/lib/project-registry";

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

  it("merges remote and local summaries by recency", () => {
    const merged = mergeProjectSummaries(
      [
        {
          projectId: "remote-only",
          projectName: "Remote",
          projectType: "office",
          versionCount: 2,
          lastAccessedAt: "2026-06-27T10:00:00.000Z"
        },
        {
          projectId: "shared",
          projectName: "Remote Shared",
          projectType: "office",
          versionCount: 3,
          lastAccessedAt: "2026-06-27T08:00:00.000Z"
        }
      ],
      [
        {
          projectId: "local-only",
          projectName: "Local",
          projectType: "healthcare",
          versionCount: 1,
          lastAccessedAt: "2026-06-27T09:00:00.000Z"
        },
        {
          projectId: "shared",
          projectName: "Local Shared",
          projectType: "office",
          versionCount: 4,
          lastAccessedAt: "2026-06-27T12:00:00.000Z"
        }
      ],
      5
    );

    expect(merged.map((entry) => entry.projectId)).toEqual(["shared", "remote-only", "local-only"]);
    expect(merged[0]?.projectName).toBe("Local Shared");
    expect(merged[0]?.versionCount).toBe(4);
  });

  it("removes a project from the registry", () => {
    const stored: ProjectRegistryEntry[] = [
      {
        projectId: "keep",
        projectName: "Keep",
        projectType: "office",
        versionCount: 1,
        lastAccessedAt: "2026-06-27T10:00:00.000Z"
      },
      {
        projectId: "remove",
        projectName: "Remove",
        projectType: "school",
        versionCount: 2,
        lastAccessedAt: "2026-06-27T09:00:00.000Z"
      }
    ];

    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => JSON.stringify(stored)),
        setItem: vi.fn()
      }
    });

    removeProjectFromRegistry("remove");

    const payload = JSON.parse(String((window.localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]));
    expect(payload).toHaveLength(1);
    expect(payload[0]?.projectId).toBe("keep");
  });
});
