import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import type { PlanVersion } from "@/lib/project-types";

export interface SchemeStrategy {
  id: string;
  label: string;
  emphasis: string;
}

export const SCHEME_STRATEGIES: SchemeStrategy[] = [
  {
    id: "circulation_first",
    label: "Circulation first",
    emphasis:
      "Organize space around efficient circulation — separate public and private routes with clear corridor logic."
  },
  {
    id: "daylight_first",
    label: "Daylight first",
    emphasis:
      "Maximize direct daylight for primary occupied rooms; corridors may grow modestly to support window access."
  },
  {
    id: "compact_first",
    label: "Compact first",
    emphasis: "Compress shared and circulation area to improve net-to-gross efficiency and usable floor ratio."
  }
];

export function summarizeTopologyOrganization(topology: PlanTopologyVersion): string {
  return `${topology.label}: circulation=${topology.topology.circulation}; core=${topology.topology.core}; daylight=${topology.topology.daylight}`;
}

export function summarizePlanOrganization(version: PlanVersion): string {
  const strategy = version.metadata?.strategy ?? version.label;
  const roomTypes = [...new Set(version.rooms.map((room) => room.type))].slice(0, 6).join(", ");
  return `${strategy}: ${version.rooms.length} rooms (${roomTypes})`;
}

export function buildPriorSchemeNote(prior: Array<PlanTopologyVersion | PlanVersion>): string {
  if (prior.length === 0) {
    return "";
  }

  const summaries = prior.map((item) =>
    "rooms" in item && Array.isArray(item.rooms) && item.rooms[0] && "polygon" in item.rooms[0]
      ? summarizePlanOrganization(item as PlanVersion)
      : summarizeTopologyOrganization(item as PlanTopologyVersion)
  );

  return `Previously generated schemes use this spatial organization: ${summaries.join("; ")}.
This scheme must differ in overall organization logic, not only local reshaping.`;
}

export function strategyForIndex(index: number): SchemeStrategy {
  return SCHEME_STRATEGIES[index % SCHEME_STRATEGIES.length]!;
}

export function applyStrategyLabel(version: PlanVersion, strategy: SchemeStrategy, letter: string): PlanVersion {
  return {
    ...version,
    label: `Scheme ${letter} · ${strategy.label}`,
    metadata: {
      ...version.metadata,
      strategy: strategy.id,
      topology: {
        ...version.metadata?.topology,
        circulation: strategy.id === "circulation_first" ? strategy.emphasis : version.metadata?.topology?.circulation,
        daylight: strategy.id === "daylight_first" ? strategy.emphasis : version.metadata?.topology?.daylight,
        core: version.metadata?.topology?.core ?? strategy.emphasis
      }
    }
  };
}
