import type { TypologyPackId } from "@/lib/typology/types";
import { resolveTypologyPackId } from "@/lib/typology/resolve";

export interface SchedulePreset {
  roomScheduleTitle: string;
  areaScheduleTitle: string;
  openingScheduleTitle: string;
}

const SCHEDULE_PRESETS: Record<TypologyPackId, SchedulePreset> = {
  healthcare: {
    roomScheduleTitle: "Clinical Room Schedule",
    areaScheduleTitle: "Clinical Area Schedule",
    openingScheduleTitle: "Door & Window Schedule"
  },
  office: {
    roomScheduleTitle: "Space Schedule",
    areaScheduleTitle: "Net / Gross Area Schedule",
    openingScheduleTitle: "Door & Window Schedule"
  },
  residential: {
    roomScheduleTitle: "Unit Room Schedule",
    areaScheduleTitle: "Unit Area Schedule",
    openingScheduleTitle: "Door & Window Schedule"
  },
  school: {
    roomScheduleTitle: "Teaching Space Schedule",
    areaScheduleTitle: "School Area Schedule",
    openingScheduleTitle: "Door & Window Schedule"
  }
};

export function resolveSchedulePreset(projectType?: string): SchedulePreset {
  const packId = resolveTypologyPackId(projectType);
  return SCHEDULE_PRESETS[packId];
}
