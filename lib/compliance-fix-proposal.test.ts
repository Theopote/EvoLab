import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { buildComplianceFixPackageById, listFixableComplianceResults } from "@/lib/compliance-fix";
import { buildComplianceFixProposal } from "@/lib/compliance-fix-proposal";
import { initialProjectData } from "@/lib/evolab-data";
import { resolveRulePack } from "@/lib/rules/rule-pack";

const baseVersion = initialProjectData.versions[0]!;
const rulePack = resolveRulePack({ codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });
const options = { buildingType: "healthcare", rulePack };

describe("compliance-fix-proposal", () => {
  it("builds corridor-width operations without calling inpaint", () => {
    const fixable = listFixableComplianceResults(baseVersion, options);
    const corridorIssue = fixable.find((item) => item.ruleId === "corridor-width");

    if (!corridorIssue) {
      return;
    }

    const fixPackage = buildComplianceFixPackageById(baseVersion, corridorIssue.id, options);

    expect(fixPackage).toBeDefined();

    const proposal = buildComplianceFixProposal(baseVersion, fixPackage!, options);

    expect(proposal?.operations.some((operation) => operation.type === "widen_corridor")).toBe(true);
  });

  it("builds plumbing alignment operations for wet-room proximity issues", () => {
    const fixable = listFixableComplianceResults(baseVersion, options);
    const plumbingIssue = fixable.find((item) => item.ruleId === "plumbing-proximity");

    if (!plumbingIssue) {
      return;
    }

    const fixPackage = buildComplianceFixPackageById(baseVersion, plumbingIssue.id, options);

    expect(fixPackage).toBeDefined();

    const proposal = buildComplianceFixProposal(baseVersion, fixPackage!, options);

    expect(proposal?.operations.some((operation) => operation.type === "align_wet_rooms")).toBe(true);
  });

  it("builds egress-distance operations for fixable egress issues", () => {
    const fixable = listFixableComplianceResults(baseVersion, options);
    const egressIssue = fixable.find((item) => item.ruleId === "egress-distance");

    if (!egressIssue) {
      return;
    }

    const fixPackage = buildComplianceFixPackageById(baseVersion, egressIssue.id, options);
    const proposal = buildComplianceFixProposal(baseVersion, fixPackage!, options);

    expect(proposal?.operations.length).toBeGreaterThan(0);
  });
});
