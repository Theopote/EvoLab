import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion } from "@/lib/project-types";

export interface CostLineItem {
  id: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  subtotal: number;
  basis: string;
}

export interface CostEstimate {
  currency: string;
  lineItems: CostLineItem[];
  totalCost: number;
  costPerSqm: number;
  summary: string;
}

interface ProjectCostRates {
  shellPerGrossSqm: number;
  mepPerGrossSqm: number;
  fitoutPerNetSqm: number;
  facadePerSqm: number;
  doorEach: number;
}

const ratesByProjectType: Record<string, ProjectCostRates> = {
  healthcare: {
    shellPerGrossSqm: 1850,
    mepPerGrossSqm: 920,
    fitoutPerNetSqm: 1450,
    facadePerSqm: 680,
    doorEach: 2800
  },
  office: {
    shellPerGrossSqm: 1420,
    mepPerGrossSqm: 760,
    fitoutPerNetSqm: 980,
    facadePerSqm: 520,
    doorEach: 2200
  },
  residential: {
    shellPerGrossSqm: 1280,
    mepPerGrossSqm: 640,
    fitoutPerNetSqm: 860,
    facadePerSqm: 460,
    doorEach: 1800
  },
  default: {
    shellPerGrossSqm: 1500,
    mepPerGrossSqm: 800,
    fitoutPerNetSqm: 1050,
    facadePerSqm: 560,
    doorEach: 2400
  }
};

function round(value: number) {
  return Math.round(value);
}

function resolveRates(projectType: string): ProjectCostRates {
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

export function calculateCostEstimate(version: PlanVersion, projectType: string): CostEstimate {
  const quantities = calculateQuantities(version);
  const rates = resolveRates(projectType);
  const grossArea = quantities.summary.grossArea;
  const netArea = quantities.summary.netUsableArea;
  const wallArea = quantities.summary.wallArea;
  const windowArea = quantities.summary.curtainWallOrWindowArea;
  const doorCount = quantities.summary.doorCount;

  const shell = grossArea * rates.shellPerGrossSqm;
  const mep = grossArea * rates.mepPerGrossSqm;
  const fitout = netArea * rates.fitoutPerNetSqm;
  const facade = (wallArea * 0.42 + windowArea) * rates.facadePerSqm;
  const doors = doorCount * rates.doorEach;

  const lineItems: CostLineItem[] = [
    {
      id: "shell",
      category: "Structure & shell",
      quantity: grossArea,
      unit: "sqm",
      unitCost: rates.shellPerGrossSqm,
      subtotal: shell,
      basis: "Gross floor area × shell unit rate"
    },
    {
      id: "mep",
      category: "MEP systems",
      quantity: grossArea,
      unit: "sqm",
      unitCost: rates.mepPerGrossSqm,
      subtotal: mep,
      basis: "Gross floor area × MEP unit rate"
    },
    {
      id: "fitout",
      category: "Interior fit-out",
      quantity: netArea,
      unit: "sqm",
      unitCost: rates.fitoutPerNetSqm,
      subtotal: fitout,
      basis: "Net usable area × fit-out unit rate"
    },
    {
      id: "facade",
      category: "Facade & envelope",
      quantity: round(wallArea * 0.42 + windowArea),
      unit: "sqm",
      unitCost: rates.facadePerSqm,
      subtotal: facade,
      basis: "Estimated opaque wall + glazing area"
    },
    {
      id: "doors",
      category: "Doors & hardware",
      quantity: doorCount,
      unit: "pcs",
      unitCost: rates.doorEach,
      subtotal: doors,
      basis: "Door count × allowance per opening"
    }
  ].map((item) => ({
    ...item,
    quantity: round(item.quantity),
    subtotal: round(item.subtotal)
  }));

  const totalCost = lineItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    currency: "USD",
    lineItems,
    totalCost,
    costPerSqm: grossArea > 0 ? round(totalCost / grossArea) : 0,
    summary: `${round(totalCost / 1_000_000)}M USD total · ${round(totalCost / grossArea)} USD/sqm gross`
  };
}

export function formatCost(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}
