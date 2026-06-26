import { describe, expect, it } from "vitest";
import {
  defaultRemixParameters,
  remixParametersFromRecord,
  remixParametersToRecord
} from "@/lib/retained-structure/remix-parameters";

describe("remix parameters", () => {
  it("provides sensible defaults", () => {
    const defaults = defaultRemixParameters({ relayoutableRoomCount: 7 });

    expect(defaults.targetRoomCount).toBe(7);
    expect(defaults.publicAreaRatio).toBe(0.25);
    expect(defaults.corridorStrategy).toBe("central");
    expect(defaults.layoutPriority).toBe("daylight");
  });

  it("round-trips through session records", () => {
    const parameters = {
      ...defaultRemixParameters({ relayoutableRoomCount: 5 }),
      targetFunctionalType: "exhibition" as const,
      corridorStrategy: "ring" as const,
      layoutPriority: "area-efficiency" as const,
      lockExteriorWindows: true
    };

    const restored = remixParametersFromRecord(remixParametersToRecord(parameters), defaultRemixParameters());

    expect(restored).toMatchObject({
      targetFunctionalType: "exhibition",
      corridorStrategy: "ring",
      layoutPriority: "area-efficiency",
      lockExteriorWindows: true
    });
  });
});
