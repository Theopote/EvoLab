import { describe, expect, it } from "vitest";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";
import {
  getPlanVersionOutput,
  normalizeToolSession,
  normalizeToolSessionOutputs,
  upsertPlanVersionOutput
} from "@/lib/tools/tool-session-utils";
import { createDemoProjectData } from "@/lib/typologies";

const sourceVersion = createDemoProjectData("healthcare").versions[0]!;
const remixedVersion = { ...sourceVersion, id: "remixed-1", label: "Remixed" };

describe("tool session utils", () => {
  it("normalizes legacy single-object outputs into an array", () => {
    const outputs = normalizeToolSessionOutputs(
      {
        kind: "plan-version",
        planVersion: sourceVersion,
        referencePreviewUrl: "data:image/png;base64,abc"
      },
      "scan.pdf · 扫描转 CAD"
    );

    expect(outputs).toHaveLength(1);
    expect(outputs[0]?.kind).toBe("plan-version");
    expect(outputs[0]?.id).toBeTruthy();
    expect(outputs[0]?.label).toBe("scan.pdf · 扫描转 CAD");
  });

  it("upserts plan-version output and preserves recognizedPlanVersion", () => {
    const recognized = sourceVersion;
    const corrected = { ...sourceVersion, id: "corrected-1" };

    const outputs = upsertPlanVersionOutput([], {
      label: "Draft",
      planVersion: corrected,
      recognizedPlanVersion: recognized
    });

    const updated = upsertPlanVersionOutput(outputs, {
      planVersion: { ...corrected, label: "Corrected again" }
    });

    const planOutput = getPlanVersionOutput({ outputs: updated } as ToolSessionDetail);
    expect(planOutput?.recognizedPlanVersion).toEqual(recognized);
    expect(planOutput?.planVersion.label).toBe("Corrected again");
  });

  it("stores source and remixed plan versions for remix sessions", () => {
    const outputs = upsertPlanVersionOutput([], {
      label: "Remix",
      planVersion: remixedVersion,
      sourcePlanVersion: sourceVersion
    });

    const planOutput = getPlanVersionOutput({ outputs } as ToolSessionDetail);
    expect(planOutput?.sourcePlanVersion).toEqual(sourceVersion);
    expect(planOutput?.planVersion).toEqual(remixedVersion);
  });

  it("normalizes full session records", () => {
    const session = normalizeToolSession({
      id: "session-1",
      toolId: "trace-to-cad",
      title: "scan.pdf",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      canPromoteToProject: true,
      status: "ready",
      outputs: {
        kind: "plan-version",
        planVersion: sourceVersion
      } as unknown as ToolSessionDetail["outputs"]
    });

    expect(Array.isArray(session.outputs)).toBe(true);
    expect(session.outputs[0]?.kind).toBe("plan-version");
  });
});
