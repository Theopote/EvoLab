import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

export interface ClimateProfile {
  heatingDegreeDays: number;
  coolingDegreeDays: number;
  designHeatingDeltaC?: number;
  designCoolingDeltaC?: number;
}

export interface HvacLoadEstimate {
  heatingLoadKw: number;
  coolingLoadKw: number;
  peakLoadKw: number;
  loadPerSqmW: number;
  method: "degree-day";
  assumptions: string[];
}

const DEFAULT_CLIMATE: ClimateProfile = {
  heatingDegreeDays: 2200,
  coolingDegreeDays: 900,
  designHeatingDeltaC: 18,
  designCoolingDeltaC: 8
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function estimateHvacLoad(
  version: PlanVersion,
  climate: ClimateProfile = DEFAULT_CLIMATE
): HvacLoadEstimate {
  const quantities = calculateQuantities(version, { scope: "building" });
  const conditionedArea = quantities.summary.netUsableArea || quantities.summary.grossArea;
  const envelopeFactor = 0.045;
  const internalGainWPerSqm = 25;

  const heatingDelta = climate.designHeatingDeltaC ?? 18;
  const coolingDelta = climate.designCoolingDeltaC ?? 8;
  const heatingLoadKw =
    (conditionedArea * envelopeFactor * (climate.heatingDegreeDays / 3000) * heatingDelta) / 1000;
  const coolingLoadKw =
    (conditionedArea * envelopeFactor * (climate.coolingDegreeDays / 1200) * coolingDelta +
      conditionedArea * internalGainWPerSqm) /
    1000;
  const peakLoadKw = Math.max(heatingLoadKw, coolingLoadKw);

  return {
    heatingLoadKw: round(heatingLoadKw),
    coolingLoadKw: round(coolingLoadKw),
    peakLoadKw: round(peakLoadKw),
    loadPerSqmW: conditionedArea > 0 ? round((peakLoadKw * 1000) / conditionedArea, 0) : 0,
    method: "degree-day",
    assumptions: [
      `Conditioned area ${round(conditionedArea)} sqm`,
      `HDD ${climate.heatingDegreeDays} / CDD ${climate.coolingDegreeDays}`,
      "Envelope factor 0.045 W/m²·K (schematic stage)",
      "Internal gains 25 W/m² for cooling"
    ]
  };
}
