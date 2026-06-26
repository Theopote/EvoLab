import type { MepLayout, PlanVersion } from "@/lib/project-types";
import { selectEquipmentForCriteria, resolveEquipmentCatalog, type EquipmentCatalog } from "@/lib/mep/equipment-database";
import { sizeMepRoutes, type PipeSizingResult } from "@/lib/mep/hydraulic-calc";
import { estimateHvacLoad, type HvacLoadEstimate } from "@/lib/mep/load-calc";

export interface MepSizingResult {
  pipeSizing: PipeSizingResult[];
  hvacLoad: HvacLoadEstimate;
  equipment: ReturnType<typeof selectEquipmentForCriteria>;
  catalogId: string;
}

export function sizeMepLayout(
  version: PlanVersion,
  mep: MepLayout,
  catalog: EquipmentCatalog = resolveEquipmentCatalog()
): MepSizingResult {
  const pipeSizing = sizeMepRoutes(mep.routes);
  const hvacLoad = estimateHvacLoad(version);
  const maxPressureDrop = Math.max(...pipeSizing.map((item) => item.pressureDropKpa), 0);
  const maxFlow = Math.max(...pipeSizing.map((item) => item.pathLengthM * 0.02), 1);

  const equipment = selectEquipmentForCriteria(
    {
      coolingKw: hvacLoad.coolingLoadKw,
      flowLps: maxFlow,
      headM: maxPressureDrop * 10,
      loadKva: Math.ceil(hvacLoad.peakLoadKw * 1.2)
    },
    catalog
  );

  return {
    pipeSizing,
    hvacLoad,
    equipment,
    catalogId: catalog.id
  };
}
