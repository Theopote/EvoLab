export interface EquipmentSpec {
  id: string;
  category: "fan_coil" | "pump" | "transformer" | "ahu";
  model: string;
  capacity: number;
  capacityUnit: string;
  manufacturer?: string;
}

export interface EquipmentSelectionCriteria {
  coolingKw?: number;
  flowLps?: number;
  headM?: number;
  loadKva?: number;
}

export interface EquipmentCatalog {
  id: string;
  label: string;
  selectFanCoil(coolingKw: number): EquipmentSpec | undefined;
  selectPump(flowLps: number, headM: number): EquipmentSpec | undefined;
  selectTransformer(loadKva: number): EquipmentSpec | undefined;
  selectAhu(peakLoadKw: number): EquipmentSpec | undefined;
}

const fanCoils: EquipmentSpec[] = [
  { id: "fc-02", category: "fan_coil", model: "FCU-02", capacity: 2.2, capacityUnit: "kW" },
  { id: "fc-04", category: "fan_coil", model: "FCU-04", capacity: 4.5, capacityUnit: "kW" },
  { id: "fc-08", category: "fan_coil", model: "FCU-08", capacity: 8.0, capacityUnit: "kW" },
  { id: "fc-12", category: "fan_coil", model: "FCU-12", capacity: 12.5, capacityUnit: "kW" }
];

const pumps: EquipmentSpec[] = [
  { id: "pump-10", category: "pump", model: "CHW-10", capacity: 10, capacityUnit: "L/s" },
  { id: "pump-25", category: "pump", model: "CHW-25", capacity: 25, capacityUnit: "L/s" },
  { id: "pump-40", category: "pump", model: "CHW-40", capacity: 40, capacityUnit: "L/s" }
];

const transformers: EquipmentSpec[] = [
  { id: "tx-400", category: "transformer", model: "TX-400", capacity: 400, capacityUnit: "kVA" },
  { id: "tx-800", category: "transformer", model: "TX-800", capacity: 800, capacityUnit: "kVA" },
  { id: "tx-1250", category: "transformer", model: "TX-1250", capacity: 1250, capacityUnit: "kVA" }
];

const ahus: EquipmentSpec[] = [
  { id: "ahu-30", category: "ahu", model: "AHU-30", capacity: 30, capacityUnit: "kW" },
  { id: "ahu-60", category: "ahu", model: "AHU-60", capacity: 60, capacityUnit: "kW" },
  { id: "ahu-120", category: "ahu", model: "AHU-120", capacity: 120, capacityUnit: "kW" }
];

function pickSmallestFit<T extends EquipmentSpec>(catalog: T[], demand: number) {
  return catalog.find((item) => item.capacity >= demand) ?? catalog[catalog.length - 1];
}

export const defaultEquipmentCatalog: EquipmentCatalog = {
  id: "evolab-default-equipment",
  label: "EvoLab schematic equipment catalog",
  selectFanCoil(coolingKw) {
    return pickSmallestFit(fanCoils, coolingKw);
  },
  selectPump(flowLps, headM) {
    const demand = flowLps * (1 + headM / 30);
    return pickSmallestFit(pumps, demand);
  },
  selectTransformer(loadKva) {
    return pickSmallestFit(transformers, loadKva);
  },
  selectAhu(peakLoadKw) {
    return pickSmallestFit(ahus, peakLoadKw);
  }
};

const catalogs: Record<string, EquipmentCatalog> = {
  [defaultEquipmentCatalog.id]: defaultEquipmentCatalog
};

export function registerEquipmentCatalog(catalog: EquipmentCatalog) {
  catalogs[catalog.id] = catalog;
}

export function resolveEquipmentCatalog(catalogId?: string): EquipmentCatalog {
  if (catalogId && catalogs[catalogId]) {
    return catalogs[catalogId];
  }

  return defaultEquipmentCatalog;
}

export function selectEquipmentForCriteria(
  criteria: EquipmentSelectionCriteria,
  catalog: EquipmentCatalog = resolveEquipmentCatalog()
) {
  return {
    fanCoil: criteria.coolingKw ? catalog.selectFanCoil(criteria.coolingKw) : undefined,
    pump:
      criteria.flowLps && criteria.headM !== undefined
        ? catalog.selectPump(criteria.flowLps, criteria.headM)
        : undefined,
    transformer: criteria.loadKva ? catalog.selectTransformer(criteria.loadKva) : undefined,
    ahu: criteria.coolingKw ? catalog.selectAhu(criteria.coolingKw) : undefined
  };
}
