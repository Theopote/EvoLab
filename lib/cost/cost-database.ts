import type { PlanVersion } from "@/lib/project-types";
import { calculateQuantities } from "@/lib/quantity-engine";

export interface CostRateEntry {
  id: string;
  category: string;
  unit: string;
  unitCost: number;
  currency: string;
  basis: string;
}

export interface CostDatabaseQuery {
  projectType: string;
  region?: string;
  version?: PlanVersion;
}

export interface CostDatabaseProvider {
  id: string;
  label: string;
  region: string;
  resolveRates(query: CostDatabaseQuery): CostRateEntry[];
}

interface ProjectCostRates {
  shellPerGrossSqm: number;
  mepPerGrossSqm: number;
  fitoutPerNetSqm: number;
  facadePerSqm: number;
  doorEach: number;
  concretePerM3: number;
  rebarPerKg: number;
}

const ratesByProjectType: Record<string, ProjectCostRates> = {
  healthcare: {
    shellPerGrossSqm: 1850,
    mepPerGrossSqm: 920,
    fitoutPerNetSqm: 1450,
    facadePerSqm: 680,
    doorEach: 2800,
    concretePerM3: 420,
    rebarPerKg: 1.35
  },
  office: {
    shellPerGrossSqm: 1420,
    mepPerGrossSqm: 760,
    fitoutPerNetSqm: 980,
    facadePerSqm: 520,
    doorEach: 2200,
    concretePerM3: 380,
    rebarPerKg: 1.2
  },
  residential: {
    shellPerGrossSqm: 1280,
    mepPerGrossSqm: 640,
    fitoutPerNetSqm: 860,
    facadePerSqm: 460,
    doorEach: 1800,
    concretePerM3: 340,
    rebarPerKg: 1.1
  },
  default: {
    shellPerGrossSqm: 1500,
    mepPerGrossSqm: 800,
    fitoutPerNetSqm: 1050,
    facadePerSqm: 560,
    doorEach: 2400,
    concretePerM3: 360,
    rebarPerKg: 1.15
  }
};

const cnRatesMultiplier = 0.72;

function resolveProjectRates(projectType: string): ProjectCostRates {
  const key = projectType.trim().toLowerCase();

  if (key.includes("health") || key.includes("clinic") || key.includes("hospital")) {
    return ratesByProjectType.healthcare;
  }

  if (key.includes("office") || key.includes("workplace")) {
    return ratesByProjectType.office;
  }

  if (key.includes("residential") || key.includes("housing") || key.includes("apartment")) {
    return ratesByProjectType.residential;
  }

  return ratesByProjectType.default;
}

function scaleRates(rates: ProjectCostRates, multiplier: number): ProjectCostRates {
  return {
    shellPerGrossSqm: rates.shellPerGrossSqm * multiplier,
    mepPerGrossSqm: rates.mepPerGrossSqm * multiplier,
    fitoutPerNetSqm: rates.fitoutPerNetSqm * multiplier,
    facadePerSqm: rates.facadePerSqm * multiplier,
    doorEach: rates.doorEach * multiplier,
    concretePerM3: rates.concretePerM3 * multiplier,
    rebarPerKg: rates.rebarPerKg * multiplier
  };
}

export const defaultCostDatabase: CostDatabaseProvider = {
  id: "evolab-default-usd",
  label: "EvoLab default ROM (USD)",
  region: "generic",
  resolveRates(query) {
    const rates = resolveProjectRates(query.projectType);
    const currency = query.region?.toUpperCase() === "CN" ? "CNY" : "USD";
    const effectiveRates = currency === "CNY" ? scaleRates(rates, cnRatesMultiplier) : rates;

    return [
      {
        id: "shell",
        category: "Structure & shell",
        unit: "sqm",
        unitCost: effectiveRates.shellPerGrossSqm,
        currency,
        basis: "Gross floor area × shell unit rate"
      },
      {
        id: "mep",
        category: "MEP systems",
        unit: "sqm",
        unitCost: effectiveRates.mepPerGrossSqm,
        currency,
        basis: "Gross floor area × MEP unit rate"
      },
      {
        id: "fitout",
        category: "Interior fit-out",
        unit: "sqm",
        unitCost: effectiveRates.fitoutPerNetSqm,
        currency,
        basis: "Net usable area × fit-out unit rate"
      },
      {
        id: "facade",
        category: "Facade & envelope",
        unit: "sqm",
        unitCost: effectiveRates.facadePerSqm,
        currency,
        basis: "Estimated opaque wall + glazing area"
      },
      {
        id: "doors",
        category: "Doors & hardware",
        unit: "pcs",
        unitCost: effectiveRates.doorEach,
        currency,
        basis: "Door count × allowance per opening"
      },
      {
        id: "concrete",
        category: "Cast-in-place concrete",
        unit: "m³",
        unitCost: effectiveRates.concretePerM3,
        currency,
        basis: "Structural concrete volume × unit rate"
      },
      {
        id: "rebar",
        category: "Reinforcing steel",
        unit: "kg",
        unitCost: effectiveRates.rebarPerKg,
        currency,
        basis: "Rebar weight × unit rate"
      }
    ];
  }
};

const providers: Record<string, CostDatabaseProvider> = {
  [defaultCostDatabase.id]: defaultCostDatabase
};

export function registerCostDatabaseProvider(provider: CostDatabaseProvider) {
  providers[provider.id] = provider;
}

export function resolveCostDatabase(providerId?: string): CostDatabaseProvider {
  if (providerId && providers[providerId]) {
    return providers[providerId];
  }

  return defaultCostDatabase;
}

export function buildCostLineItemsFromDatabase(
  version: PlanVersion,
  query: CostDatabaseQuery,
  provider: CostDatabaseProvider = resolveCostDatabase()
) {
  const quantities = calculateQuantities(version, { scope: "building" });
  const rates = provider.resolveRates({ ...query, version });
  const rateMap = Object.fromEntries(rates.map((rate) => [rate.id, rate]));
  const structural = quantities.summary.structural;

  const grossArea = quantities.summary.grossArea;
  const netArea = quantities.summary.netUsableArea;
  const wallArea = quantities.summary.wallAreaNet ?? quantities.summary.wallArea;
  const windowArea = quantities.summary.curtainWallOrWindowArea;
  const doorCount = quantities.summary.doorCount;

  const shell = grossArea * (rateMap.shell?.unitCost ?? 0);
  const mep = grossArea * (rateMap.mep?.unitCost ?? 0);
  const fitout = netArea * (rateMap.fitout?.unitCost ?? 0);
  const facade = (wallArea * 0.42 + windowArea) * (rateMap.facade?.unitCost ?? 0);
  const doors = doorCount * (rateMap.doors?.unitCost ?? 0);
  const concrete = (structural?.totalConcreteM3 ?? 0) * (rateMap.concrete?.unitCost ?? 0);
  const rebar = (structural?.rebarWeightKg ?? 0) * (rateMap.rebar?.unitCost ?? 0);

  const currency = rates[0]?.currency ?? "USD";

  return {
    currency,
    providerId: provider.id,
    lineItems: [
      { rate: rateMap.shell, quantity: grossArea, subtotal: shell },
      { rate: rateMap.mep, quantity: grossArea, subtotal: mep },
      { rate: rateMap.fitout, quantity: netArea, subtotal: fitout },
      { rate: rateMap.facade, quantity: wallArea * 0.42 + windowArea, subtotal: facade },
      { rate: rateMap.doors, quantity: doorCount, subtotal: doors },
      { rate: rateMap.concrete, quantity: structural?.totalConcreteM3 ?? 0, subtotal: concrete },
      { rate: rateMap.rebar, quantity: structural?.rebarWeightKg ?? 0, subtotal: rebar }
    ].filter((item) => item.rate && item.subtotal > 0)
  };
}
