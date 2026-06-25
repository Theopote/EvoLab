import { initialProjectData } from "@/lib/evolab-data";
import type { DesignBrief, Point } from "@/lib/project-types";

export const defaultOutline: Point[] = [
  [0, 0],
  [72, 0],
  [72, 42],
  [0, 42]
];

export const defaultBrief: DesignBrief = {
  projectType: initialProjectData.projectType,
  description:
    "Outpatient clinic with clear public waiting, clinical rooms, staff work area, compact core, shafts aligned with equipment room, and strong south daylight.",
  floors: 3,
  targetArea: 2400,
  corePreference: "north service edge",
  orientationPreference: "south daylight"
};
