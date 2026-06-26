import {
  buildCostLineItemsFromDatabase,
  resolveCostDatabase,
  type CostDatabaseProvider
} from "@/lib/cost/cost-database";
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
  providerId?: string;
}

export interface CostEstimateOptions {
  region?: string;
  providerId?: string;
  provider?: CostDatabaseProvider;
}

function round(value: number) {
  return Math.round(value);
}

export function calculateCostEstimate(
  version: PlanVersion,
  projectType: string,
  options: CostEstimateOptions = {}
): CostEstimate {
  const provider = options.provider ?? resolveCostDatabase(options.providerId);
  const built = buildCostLineItemsFromDatabase(version, { projectType, region: options.region, version }, provider);
  const grossArea = version.rooms.reduce((total, room) => total + room.areaSqm, 0);

  const lineItems: CostLineItem[] = built.lineItems.map((item) => ({
    id: item.rate!.id,
    category: item.rate!.category,
    quantity: round(item.quantity),
    unit: item.rate!.unit,
    unitCost: item.rate!.unitCost,
    subtotal: round(item.subtotal),
    basis: item.rate!.basis
  }));

  const totalCost = lineItems.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    currency: built.currency,
    providerId: built.providerId,
    lineItems,
    totalCost,
    costPerSqm: grossArea > 0 ? round(totalCost / grossArea) : 0,
    summary: grossArea > 0 ? `${round(totalCost / 1_000_000)}M ${built.currency} total · ${round(totalCost / grossArea)} ${built.currency}/sqm gross` : `${round(totalCost / 1_000_000)}M ${built.currency} total`
  };
}

export function formatCost(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}
