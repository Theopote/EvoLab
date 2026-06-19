import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import {
  buildComplianceFixPackageById,
  listFixableComplianceResults
} from "@/lib/compliance-fix";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import { deriveVerticalElements } from "@/lib/vertical-elements";

const baseVersion = initialProjectData.versions[0]!;
const rulePack = resolveRulePack({ codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });

describe("compliance-fix", () => {
  it("builds an egress-distance fix package for the worst egress room", () => {
    const fixable = listFixableComplianceResults(baseVersion, {
      buildingType: "healthcare",
      rulePack
    });
    const egressResult = fixable.find((item) => item.ruleId === "egress-distance");

    expect(egressResult).toBeDefined();

    const fixPackage = buildComplianceFixPackageById(baseVersion, egressResult!.id, {
      buildingType: "healthcare",
      rulePack
    });

    expect(fixPackage?.ruleId).toBe("egress-distance");
    expect(fixPackage?.allowedRoomIds.length).toBeGreaterThan(0);
    expect(fixPackage?.userRequest).toMatch(/egress/i);
  });

  it("builds a single-floor alignment fix package for vertical issues", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const elements = deriveVerticalElements(expanded);
    const tampered = {
      ...expanded,
      levels: expanded.levels.map((level) =>
        level.id === "level-01"
          ? {
              ...level,
              rooms: level.rooms.map((room) =>
                room.type === "corridor"
                  ? {
                      ...room,
                      polygon: room.polygon.map(([x, y]) => [x + 8, y + 8] as const)
                    }
                  : room
              )
            }
          : level
      ),
      verticalElements: elements
    };

    const fixable = listFixableComplianceResults(tampered, {
      buildingType: "healthcare",
      rulePack
    });
    const alignmentResult = fixable.find(
      (item) => item.ruleId === "vertical_alignment" && item.fixScope === "single_floor"
    );

    expect(alignmentResult).toBeDefined();

    const fixPackage = buildComplianceFixPackageById(tampered, alignmentResult!.id, {
      buildingType: "healthcare",
      rulePack
    });

    expect(fixPackage?.levelId).toBe("level-01");
    expect(fixPackage?.structuralConstraints?.lockedPositions?.length).toBeGreaterThan(0);
    expect(fixPackage?.userRequest).toMatch(/do not move the structural position/i);
  });
});
