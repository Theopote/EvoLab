import { normalizeProjectVersions } from "@/lib/architecture-model";
import { normalizeProjectData } from "@/lib/project-domain";
import type { ProjectData } from "@/lib/project-types";

const rawProjectData = {
  projectId: "evolab-demo-001",
  projectName: "EvoLab Healthcare Concept Study",
  projectType: "healthcare",
  activeVersionId: "scheme-a",
  versions: normalizeProjectVersions([
    {
      id: "scheme-a",
      label: "Scheme A / Central Core",
      createdAt: "2026-06-14T09:00:00.000Z",
      outline: [
        [0, 0],
        [72, 0],
        [72, 42],
        [0, 42]
      ],
      overallBounds: {
        width: 72,
        height: 42
      },
      scores: {
        areaEfficiency: 84,
        circulationScore: 78,
        daylightScore: 82,
        mepAlignmentScore: 76,
        riskCount: 2
      },
      rooms: [
        {
          id: "lobby-01",
          name: "Outpatient Lobby",
          type: "lobby",
          zone: "public",
          polygon: [
            [0, 0],
            [24, 0],
            [24, 18],
            [0, 18]
          ],
          areaSqm: 432,
          ceilingHeight: 5.4,
          orientation: "south",
          doors: [{ wall: "south", position: 0.45, width: 4.8 }],
          windows: [{ wall: "south", position: 0.5, width: 12 }],
          needsDaylight: true,
          adjacents: ["corridor-01", "consult-01"]
        },
        {
          id: "corridor-01",
          name: "Main Medical Street",
          type: "corridor",
          zone: "circulation",
          polygon: [
            [24, 0],
            [34, 0],
            [34, 42],
            [24, 42]
          ],
          areaSqm: 420,
          ceilingHeight: 3.6,
          doors: [],
          windows: [],
          adjacents: ["lobby-01", "consult-01", "office-01", "core-01"]
        },
        {
          id: "consult-01",
          name: "Consultation Cluster",
          type: "consultation",
          zone: "semi_public",
          polygon: [
            [34, 0],
            [72, 0],
            [72, 20],
            [34, 20]
          ],
          areaSqm: 760,
          ceilingHeight: 3.3,
          orientation: "south",
          doors: [{ wall: "west", position: 0.45, width: 1.4 }],
          windows: [{ wall: "south", position: 0.5, width: 18 }],
          needsDaylight: true,
          needsPlumbing: true,
          adjacents: ["corridor-01", "shaft-01"]
        },
        {
          id: "office-01",
          name: "Clinical Offices",
          type: "office",
          zone: "private",
          polygon: [
            [34, 20],
            [56, 20],
            [56, 42],
            [34, 42]
          ],
          areaSqm: 484,
          ceilingHeight: 3.3,
          orientation: "north",
          doors: [{ wall: "west", position: 0.5, width: 1.2 }],
          windows: [{ wall: "north", position: 0.5, width: 10 }],
          needsDaylight: true,
          adjacents: ["corridor-01", "equipment-01"]
        },
        {
          id: "core-01",
          name: "Stair Elevator Core",
          type: "elevator",
          zone: "circulation",
          polygon: [
            [56, 20],
            [66, 20],
            [66, 34],
            [56, 34]
          ],
          areaSqm: 140,
          ceilingHeight: 3.3,
          doors: [{ wall: "west", position: 0.5, width: 1.8 }],
          windows: [],
          adjacents: ["corridor-01", "shaft-01"]
        },
        {
          id: "shaft-01",
          name: "Service Shaft",
          type: "shaft",
          zone: "service",
          polygon: [
            [66, 20],
            [72, 20],
            [72, 28],
            [66, 28]
          ],
          areaSqm: 48,
          ceilingHeight: 3.3,
          doors: [],
          windows: [],
          adjacents: ["consult-01", "core-01"]
        },
        {
          id: "equipment-01",
          name: "Equipment Room",
          type: "equipment_room",
          zone: "service",
          polygon: [
            [56, 34],
            [72, 34],
            [72, 42],
            [56, 42]
          ],
          areaSqm: 128,
          ceilingHeight: 3.6,
          doors: [{ wall: "west", position: 0.5, width: 1.4 }],
          windows: [],
          needsPlumbing: true,
          adjacents: ["office-01", "shaft-01"]
        }
      ]
    }
  ])
};

export const initialProjectData: ProjectData = normalizeProjectData(rawProjectData);
