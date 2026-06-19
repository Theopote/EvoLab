import type { RoomProtrusion } from "@/lib/project-types";

export interface BayWindowGfaThresholds {
  maxDepthM: number;
  minSillHeightM: number;
  minHeadroomM: number;
  notice: string;
}

export const defaultBayWindowGfaThresholds: BayWindowGfaThresholds = {
  maxDepthM: 0.6,
  minSillHeightM: 0.45,
  minHeadroomM: 2.2,
  notice: "Placeholder thresholds only — verify against local GFA regulations before issuing drawings."
};

export function resolveBayWindowGfaThresholds(
  overrides?: Partial<BayWindowGfaThresholds>
): BayWindowGfaThresholds {
  return {
    ...defaultBayWindowGfaThresholds,
    ...overrides
  };
}

export function evaluateBayWindowGfaExempt(
  protrusion: RoomProtrusion,
  thresholds: BayWindowGfaThresholds = defaultBayWindowGfaThresholds
) {
  if (protrusion.type !== "bay_window") {
    return {
      exempt: false,
      basis: `${protrusion.type} is not eligible for bay-window GFA exemption rules.`
    };
  }

  const sill = protrusion.sillHeightM ?? 0;
  const depth = protrusion.depthM;
  const headroom = protrusion.headroomM ?? thresholds.minHeadroomM;

  const depthOk = depth <= thresholds.maxDepthM + 0.0001;
  const sillOk = sill >= thresholds.minSillHeightM - 0.0001;
  const headroomOk = headroom >= thresholds.minHeadroomM - 0.0001;
  const exempt = depthOk && sillOk && headroomOk;

  const basis = exempt
    ? `Eligible under configured bay-window GFA rule (depth ≤ ${thresholds.maxDepthM}m, sill ≥ ${thresholds.minSillHeightM}m, headroom ≥ ${thresholds.minHeadroomM}m). ${thresholds.notice}`
    : `Counts toward GFA under configured thresholds (depth ≤ ${thresholds.maxDepthM}m, sill ≥ ${thresholds.minSillHeightM}m, headroom ≥ ${thresholds.minHeadroomM}m). ${thresholds.notice}`;

  return { exempt, basis };
}
