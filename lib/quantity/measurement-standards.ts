export type MeasurementStandardId = "gb50300" | "uniformat" | "masterformat";

export interface QuantityClassification {
  standardId: MeasurementStandardId;
  code: string;
  label: string;
  unit: string;
}

export interface MeasurementRuleSet {
  id: MeasurementStandardId;
  label: string;
  region: string;
  classify(rowId: string): QuantityClassification | undefined;
}

const gb50300Map: Record<string, Omit<QuantityClassification, "standardId">> = {
  "gross-area": { code: "010101", label: "建筑面积", unit: "m²" },
  "net-area": { code: "010102", label: "使用面积", unit: "m²" },
  "external-wall-length": { code: "010201", label: "外墙长度", unit: "m" },
  "internal-wall-length": { code: "010202", label: "内墙长度", unit: "m" },
  "wall-area-gross": { code: "010301", label: "墙体面积（毛）", unit: "m²" },
  "wall-area-net": { code: "010302", label: "墙体面积（净，扣洞口）", unit: "m²" },
  "opening-deduction": { code: "010303", label: "门窗洞口扣减", unit: "m²" },
  doors: { code: "010401", label: "门", unit: "樘" },
  windows: { code: "010402", label: "窗", unit: "樘" },
  "slab-area": { code: "010501", label: "楼地面", unit: "m²" },
  "roof-area": { code: "010601", label: "屋面", unit: "m²" },
  "curtain-window-area": { code: "010701", label: "幕墙/窗面积", unit: "m²" },
  "concrete-volume": { code: "020101", label: "混凝土体积", unit: "m³" },
  "rebar-weight": { code: "020201", label: "钢筋重量", unit: "t" },
  "slab-concrete": { code: "020301", label: "楼板混凝土", unit: "m³" },
  "stair-concrete": { code: "020401", label: "楼梯混凝土", unit: "m³" }
};

const uniformatMap: Record<string, Omit<QuantityClassification, "standardId">> = {
  "gross-area": { code: "A10", label: "Substructure / floor plate", unit: "sqm" },
  "net-area": { code: "B10", label: "Superstructure usable area", unit: "sqm" },
  "wall-area-net": { code: "B2010", label: "Exterior walls", unit: "sqm" },
  "slab-area": { code: "B3010", label: "Floor slabs", unit: "sqm" },
  "roof-area": { code: "B3020", label: "Roof slabs", unit: "sqm" },
  "concrete-volume": { code: "B10", label: "Cast-in-place concrete", unit: "m³" },
  "rebar-weight": { code: "B20", label: "Reinforcing steel", unit: "kg" },
  doors: { code: "C1020", label: "Doors", unit: "ea" },
  windows: { code: "C1030", label: "Windows", unit: "ea" }
};

const masterformatMap: Record<string, Omit<QuantityClassification, "standardId">> = {
  "gross-area": { code: "03 30 00", label: "Cast-in-Place Concrete (floor plate basis)", unit: "sqm" },
  "wall-area-net": { code: "04 21 00", label: "Clay Unit Masonry / wall finishes", unit: "sqm" },
  "slab-area": { code: "03 30 00", label: "Cast-in-Place Concrete slabs", unit: "sqm" },
  "concrete-volume": { code: "03 30 00", label: "Cast-in-Place Concrete", unit: "m³" },
  "rebar-weight": { code: "03 20 00", label: "Concrete Reinforcing", unit: "kg" },
  doors: { code: "08 11 00", label: "Metal Doors and Frames", unit: "ea" },
  windows: { code: "08 50 00", label: "Windows", unit: "ea" },
  "curtain-window-area": { code: "08 44 00", label: "Curtain Wall and Glazed Assemblies", unit: "sqm" }
};

function buildRuleSet(
  id: MeasurementStandardId,
  label: string,
  region: string,
  map: Record<string, Omit<QuantityClassification, "standardId">>
): MeasurementRuleSet {
  return {
    id,
    label,
    region,
    classify(rowId: string) {
      const entry = map[rowId];
      if (!entry) {
        return undefined;
      }

      return { standardId: id, ...entry };
    }
  };
}

export const gb50300RuleSet = buildRuleSet("gb50300", "国标工程量清单 (GB50300)", "CN", gb50300Map);
export const uniformatRuleSet = buildRuleSet("uniformat", "UNIFORMAT II", "INTL", uniformatMap);
export const masterformatRuleSet = buildRuleSet(
  "masterformat",
  "MasterFormat",
  "US",
  masterformatMap
);

const ruleSets: Record<MeasurementStandardId, MeasurementRuleSet> = {
  gb50300: gb50300RuleSet,
  uniformat: uniformatRuleSet,
  masterformat: masterformatRuleSet
};

export function resolveMeasurementRuleSet(standardId: MeasurementStandardId = "gb50300"): MeasurementRuleSet {
  return ruleSets[standardId] ?? gb50300RuleSet;
}

export function listMeasurementStandards(): MeasurementRuleSet[] {
  return Object.values(ruleSets);
}
