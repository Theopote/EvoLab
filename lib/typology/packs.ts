import { buildFlowAnalysisLayers } from "@/lib/typology/analysis-layers";
import type { TypologyPack, TypologyTopologyConfig } from "@/lib/typology/types";
import {
  defaultHealthcareRulePack,
  officeRulePack,
  residentialRulePack,
  schoolRulePack
} from "@/lib/rules/rule-pack";
import type { ProgramGoals } from "@/lib/rules/types";

const healthcareGoals: ProgramGoals = {
  id: "goals-healthcare",
  label: "Healthcare priorities",
  projectType: "healthcare",
  weights: {
    areaEfficiency: 0.22,
    circulation: 0.22,
    daylight: 0.18,
    wetCore: 0.16,
    egress: 0.14,
    structureFit: 0.08,
    riskPenalty: 4
  }
};

const officeGoals: ProgramGoals = {
  id: "goals-office",
  label: "Office priorities",
  projectType: "office",
  weights: {
    areaEfficiency: 0.34,
    circulation: 0.2,
    daylight: 0.22,
    wetCore: 0.1,
    egress: 0.08,
    structureFit: 0.06,
    riskPenalty: 3
  }
};

const residentialGoals: ProgramGoals = {
  id: "goals-residential",
  label: "Residential priorities",
  projectType: "residential",
  weights: {
    areaEfficiency: 0.24,
    circulation: 0.14,
    daylight: 0.28,
    wetCore: 0.12,
    egress: 0.12,
    structureFit: 0.1,
    riskPenalty: 3
  }
};

const schoolGoals: ProgramGoals = {
  id: "goals-school",
  label: "School priorities",
  projectType: "school",
  weights: {
    areaEfficiency: 0.2,
    circulation: 0.24,
    daylight: 0.22,
    wetCore: 0.1,
    egress: 0.16,
    structureFit: 0.08,
    riskPenalty: 4
  }
};

const healthcareTopology: TypologyTopologyConfig = {
  strategies: [
    {
      id: "central-core",
      label: "Central Core",
      layoutKind: "central_core",
      circulation: "Single central medical street links public arrival, clinical rooms and service rooms.",
      core: "Vertical core is placed near the middle-right clinical/service zone.",
      daylight: "Public and clinical rooms sit on external south or north edges.",
      plumbing: "Wet consultation and equipment rooms cluster around one shaft."
    },
    {
      id: "dual-corridor",
      label: "Dual Corridor",
      layoutKind: "dual_corridor",
      circulation: "Two connected corridors separate public south rooms and staff/service north rooms.",
      core: "Core sits at the east end and connects both corridor bands.",
      daylight: "Consultation and office bars use opposite external edges.",
      plumbing: "Shaft is paired with equipment and close to consultation rooms."
    },
    {
      id: "service-spine",
      label: "Service Spine",
      layoutKind: "service_spine",
      circulation: "A vertical service spine separates public arrival from clinical and back-of-house spaces.",
      core: "Core is embedded in the spine for compact egress.",
      daylight: "Large public and clinical zones keep external exposure.",
      plumbing: "Shaft and equipment room form a compact service cluster."
    }
  ],
  roomTemplates: [
    { id: "lobby-01", name: "Outpatient Lobby", roomType: "lobby", zone: "public", areaShare: 0.18, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "corridor-01", name: "Central Medical Street", roomType: "corridor", zone: "circulation", areaShare: 0.14, preferredEdge: "interior", adjacencyIds: ["lobby-01", "consult-01", "office-01", "core-01"] },
    { id: "consult-01", name: "Consultation Cluster", roomType: "consultation", zone: "semi_public", areaShare: 0.28, needsDaylight: true, needsPlumbing: true, preferredEdge: "south", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "office-01", name: "Clinical Offices", roomType: "office", zone: "private", areaShare: 0.15, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01"] },
    { id: "core-01", name: "Vertical Core", roomType: "elevator", zone: "circulation", areaShare: 0.08, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "shaft-01", name: "Service Shaft", roomType: "shaft", zone: "service", areaShare: 0.04, preferredEdge: "interior", adjacencyIds: ["consult-01", "core-01", "equipment-01"] },
    { id: "equipment-01", name: "Equipment Room", roomType: "equipment_room", zone: "service", areaShare: 0.11, needsPlumbing: true, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] }
  ],
  wetRoomTypes: ["bathroom", "kitchen", "consultation", "equipment_room", "shaft"],
  promptGuidance:
    "Healthcare outpatient topology: keep public lobby separate from clinical consultation zones, cluster wet clinical and equipment rooms near a service shaft, and route all clinical rooms through a corridor."
};

const officeTopology: TypologyTopologyConfig = {
  strategies: [
    {
      id: "open-plan",
      label: "Open Plan",
      layoutKind: "open_plan",
      circulation: "Reception feeds a single office street linking open workspace, meeting rooms, and support core.",
      core: "Vertical core sits on the east edge with pantry and shaft stacked nearby.",
      daylight: "Open workspace and meeting rooms occupy south and north perimeter bands.",
      plumbing: "Pantry and wet support cluster at the core with a dedicated shaft."
    },
    {
      id: "side-core",
      label: "Side Core",
      layoutKind: "side_core",
      circulation: "Visitor lobby and open office share the west zone; perimeter corridor links focus rooms on the east.",
      core: "Side core on the east edge connects all work zones.",
      daylight: "Lobby and open office use the south facade; focus rooms use the north edge.",
      plumbing: "Support zone and shaft are embedded in the side core."
    },
    {
      id: "support-spine",
      label: "Support Spine",
      layoutKind: "service_spine",
      circulation: "A support spine separates arrival lounge from workspace bars and collaboration zones.",
      core: "Core is embedded at the end of the workspace bar for compact egress.",
      daylight: "Workspace and collaboration zones keep external exposure on south and north.",
      plumbing: "Pantry and shaft form a compact service cluster off the spine."
    }
  ],
  roomTemplates: [
    { id: "lobby-01", name: "Reception Lobby", roomType: "lobby", zone: "public", areaShare: 0.12, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "corridor-01", name: "Office Street", roomType: "corridor", zone: "circulation", areaShare: 0.1, preferredEdge: "interior", adjacencyIds: ["lobby-01", "office-01", "office-02", "core-01"] },
    { id: "office-01", name: "Open Workspace", roomType: "office", zone: "private", areaShare: 0.45, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "office-02", name: "Meeting Rooms", roomType: "office", zone: "semi_public", areaShare: 0.12, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01", "office-01"] },
    { id: "core-01", name: "Vertical Core", roomType: "elevator", zone: "circulation", areaShare: 0.08, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "shaft-01", name: "Service Shaft", roomType: "shaft", zone: "service", areaShare: 0.03, preferredEdge: "interior", adjacencyIds: ["core-01", "equipment-01"] },
    { id: "equipment-01", name: "Pantry / IT", roomType: "equipment_room", zone: "service", areaShare: 0.1, needsPlumbing: true, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] }
  ],
  wetRoomTypes: ["bathroom", "kitchen", "equipment_room", "shaft"],
  promptGuidance:
    "Office topology: prioritize daylight for open workspace, keep visitor reception distinct from focus/meeting rooms, and cluster pantry, IT, and wet support near the vertical core."
};

const residentialTopology: TypologyTopologyConfig = {
  strategies: [
    {
      id: "central-core",
      label: "Central Core",
      layoutKind: "central_core",
      circulation: "Entry lobby connects to a unit corridor linking living, bedroom, and wet rooms.",
      core: "Vertical core sits on the east edge with wet shaft stacked nearby.",
      daylight: "Living room uses south facade; bedroom uses north edge.",
      plumbing: "Kitchen and bathroom cluster around the wet shaft."
    },
    {
      id: "dual-corridor",
      label: "Dual Corridor",
      layoutKind: "dual_corridor",
      circulation: "South corridor serves living zone; north corridor serves bedrooms and wet rooms.",
      core: "Core at the east end connects both corridor bands.",
      daylight: "Living and bedroom bars use opposite external edges.",
      plumbing: "Kitchen and bathroom pair with shaft near the core."
    },
    {
      id: "service-spine",
      label: "Service Spine",
      layoutKind: "service_spine",
      circulation: "Service spine separates entry lobby from living and bedroom zones.",
      core: "Core embedded at the end of the unit bar.",
      daylight: "Living and bedroom zones keep perimeter exposure.",
      plumbing: "Wet shaft clusters kitchen and bathroom at the service edge."
    }
  ],
  roomTemplates: [
    { id: "lobby-01", name: "Entry Lobby", roomType: "lobby", zone: "public", areaShare: 0.1, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "corridor-01", name: "Unit Corridor", roomType: "corridor", zone: "circulation", areaShare: 0.08, preferredEdge: "interior", adjacencyIds: ["lobby-01", "living-01", "bedroom-01", "core-01"] },
    { id: "living-01", name: "Living Room", roomType: "living_room", zone: "private", areaShare: 0.28, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01", "kitchen-01"] },
    { id: "bedroom-01", name: "Bedroom", roomType: "bedroom", zone: "private", areaShare: 0.22, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01"] },
    { id: "kitchen-01", name: "Kitchen", roomType: "kitchen", zone: "service", areaShare: 0.1, needsPlumbing: true, preferredEdge: "interior", adjacencyIds: ["living-01", "shaft-01"] },
    { id: "bathroom-01", name: "Bathroom", roomType: "bathroom", zone: "service", areaShare: 0.06, needsPlumbing: true, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "core-01", name: "Vertical Core", roomType: "elevator", zone: "circulation", areaShare: 0.08, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "shaft-01", name: "Wet Shaft", roomType: "shaft", zone: "service", areaShare: 0.04, preferredEdge: "interior", adjacencyIds: ["kitchen-01", "bathroom-01", "core-01"] }
  ],
  wetRoomTypes: ["bathroom", "kitchen", "shaft"],
  promptGuidance:
    "Residential topology: connect all habitable rooms to a unit corridor, place living on the south facade when possible, and stack kitchen and bathroom near a wet shaft."
};

const schoolTopology: TypologyTopologyConfig = {
  strategies: [
    {
      id: "classroom-wing",
      label: "Classroom Wing",
      layoutKind: "classroom_wing",
      circulation: "Main entrance feeds a teaching corridor along a classroom wing with staff and restrooms at the rear.",
      core: "Stair core at the east end connects entrance, corridor, and egress paths.",
      daylight: "Classroom wing uses the south facade; staff office uses the north edge.",
      plumbing: "Restrooms cluster near shaft and core for compact wet routing."
    },
    {
      id: "hub-spine",
      label: "Hub Spine",
      layoutKind: "hub_spine",
      circulation: "Entry hall connects a horizontal hub spine linking classroom bar, faculty office, and core.",
      core: "Core on the east edge serves the full teaching floor.",
      daylight: "Classrooms use north exposure; faculty office uses east edge.",
      plumbing: "Restrooms and janitor storage pair with shaft near the core."
    },
    {
      id: "central-core",
      label: "Central Core",
      layoutKind: "central_core",
      circulation: "School lobby connects a main corridor linking classrooms, admin office, and central core.",
      core: "Central core on the east edge anchors egress for the teaching floor.",
      daylight: "Classrooms on south; admin and storage on north/service edge.",
      plumbing: "Restrooms and storage cluster near shaft at the core."
    }
  ],
  roomTemplates: [
    { id: "lobby-01", name: "Main Entrance", roomType: "lobby", zone: "public", areaShare: 0.1, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "corridor-01", name: "Teaching Corridor", roomType: "corridor", zone: "circulation", areaShare: 0.14, preferredEdge: "interior", adjacencyIds: ["lobby-01", "classroom-01", "office-01", "core-01"] },
    { id: "classroom-01", name: "Classrooms", roomType: "other", zone: "private", areaShare: 0.4, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
    { id: "office-01", name: "Staff Office", roomType: "office", zone: "semi_public", areaShare: 0.1, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01"] },
    { id: "bathroom-01", name: "Restrooms", roomType: "bathroom", zone: "service", areaShare: 0.06, needsPlumbing: true, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "core-01", name: "Stair Core", roomType: "stair", zone: "circulation", areaShare: 0.07, preferredEdge: "interior", adjacencyIds: ["corridor-01", "shaft-01"] },
    { id: "shaft-01", name: "Service Shaft", roomType: "shaft", zone: "service", areaShare: 0.03, preferredEdge: "interior", adjacencyIds: ["bathroom-01", "core-01"] },
    { id: "equipment-01", name: "Storage", roomType: "equipment_room", zone: "service", areaShare: 0.1, preferredEdge: "interior", adjacencyIds: ["corridor-01", "office-01"] }
  ],
  wetRoomTypes: ["bathroom", "equipment_room", "shaft"],
  promptGuidance:
    "School topology: route all classrooms through a teaching corridor, keep main entrance public and distinct from staff zones, and cluster restrooms near core/shaft for egress and wet routing."
};

export const healthcareTypologyPack: TypologyPack = {
  id: "healthcare",
  label: "Healthcare",
  aliases: ["healthcare", "hospital", "clinic", "medical"],
  roomTypes: ["lobby", "corridor", "consultation", "ward", "office", "bathroom", "equipment_room", "shaft", "stair", "elevator"],
  adjacencyRules: [
    { fromRoomTypes: ["consultation", "ward"], toRoomTypes: ["corridor"], relationship: "must" },
    { fromRoomTypes: ["bathroom"], toRoomTypes: ["shaft", "equipment_room"], relationship: "prefer" },
    { fromRoomTypes: ["equipment_room"], toRoomTypes: ["shaft"], relationship: "prefer" }
  ],
  flowDefinitions: [
    {
      id: "primary",
      layerId: "primary_flow",
      segments: [{ pathId: "primary-flow", fromRoomTypes: ["lobby"], toRoomTypes: ["consultation", "corridor"] }]
    },
    {
      id: "staff",
      layerId: "staff_flow",
      segments: [{ pathId: "staff-flow", fromRoomTypes: ["office"], toRoomTypes: ["consultation", "corridor"] }]
    },
    {
      id: "service",
      layerId: "service_flow",
      segments: [],
      serviceSplit: {
        clean: { pathId: "clean-flow", fromRoomTypes: ["lobby"], toRoomTypes: ["corridor"] },
        dirty: { pathId: "dirty-flow", fromRoomTypes: ["equipment_room", "shaft"], toRoomTypes: ["corridor"] }
      }
    }
  ],
  analysisLayers: buildFlowAnalysisLayers({
    primary: "Patient flow",
    staff: "Staff flow",
    service: "Clean / dirty flow"
  }),
  defaultAnalysisLayers: ["function_zones", "primary_flow", "egress_path", "daylight"],
  rulePack: defaultHealthcareRulePack,
  programGoals: healthcareGoals,
  defaultBrief: {
    projectType: "healthcare",
    description: "Outpatient clinic with clear patient and staff separation",
    corePreference: "central core",
    orientationPreference: "south daylight"
  },
  defaultProgramSpaces: [
    { name: "Public Lobby", roomType: "lobby", zone: "public", priority: "required", needsDaylight: true },
    { name: "Main Corridor", roomType: "corridor", zone: "circulation", priority: "required" },
    { name: "Clinical Rooms", roomType: "consultation", zone: "private", priority: "preferred", needsDaylight: true }
  ],
  exportPresets: [
    {
      id: "healthcare-clinical-summary",
      label: "Clinical area summary",
      includeLayers: ["function_zones", "primary_flow", "staff_flow", "service_flow"],
      quantityGroupBy: "roomType"
    }
  ],
  topology: healthcareTopology
};

export const officeTypologyPack: TypologyPack = {
  id: "office",
  label: "Office",
  aliases: ["office", "commercial", "workplace"],
  roomTypes: ["lobby", "corridor", "office", "bathroom", "equipment_room", "shaft", "stair", "elevator"],
  adjacencyRules: [
    { fromRoomTypes: ["office"], toRoomTypes: ["corridor"], relationship: "must" },
    { fromRoomTypes: ["lobby"], toRoomTypes: ["corridor"], relationship: "must" }
  ],
  flowDefinitions: [
    {
      id: "primary",
      layerId: "primary_flow",
      segments: [{ pathId: "visitor-flow", fromRoomTypes: ["lobby"], toRoomTypes: ["office", "corridor"] }]
    },
    {
      id: "staff",
      layerId: "staff_flow",
      segments: [{ pathId: "staff-flow", fromRoomTypes: ["office"], toRoomTypes: ["corridor", "lobby"] }]
    },
    {
      id: "service",
      layerId: "service_flow",
      segments: [{ pathId: "service-flow", fromRoomTypes: ["equipment_room"], toRoomTypes: ["corridor", "shaft"] }]
    }
  ],
  analysisLayers: buildFlowAnalysisLayers({
    primary: "Visitor flow",
    staff: "Staff flow",
    service: "Support flow"
  }),
  defaultAnalysisLayers: ["function_zones", "primary_flow", "egress_path", "daylight"],
  rulePack: officeRulePack,
  programGoals: officeGoals,
  defaultBrief: {
    projectType: "office",
    description: "Open office with visitor reception and support zones",
    corePreference: "side core",
    orientationPreference: "south daylight"
  },
  defaultProgramSpaces: [
    { name: "Reception Lobby", roomType: "lobby", zone: "public", priority: "required", needsDaylight: true },
    { name: "Office Corridor", roomType: "corridor", zone: "circulation", priority: "required" },
    { name: "Workspaces", roomType: "office", zone: "private", priority: "preferred", needsDaylight: true }
  ],
  exportPresets: [
    {
      id: "office-area-summary",
      label: "Office area summary",
      includeLayers: ["function_zones", "primary_flow", "daylight"],
      quantityGroupBy: "zone"
    }
  ],
  topology: officeTopology
};

export const residentialTypologyPack: TypologyPack = {
  id: "residential",
  label: "Residential",
  aliases: ["residential", "housing", "apartment"],
  roomTypes: ["lobby", "corridor", "living_room", "bedroom", "kitchen", "bathroom", "shaft", "stair", "elevator"],
  adjacencyRules: [
    { fromRoomTypes: ["bedroom", "living_room"], toRoomTypes: ["corridor"], relationship: "prefer" },
    { fromRoomTypes: ["kitchen", "bathroom"], toRoomTypes: ["shaft"], relationship: "prefer" }
  ],
  flowDefinitions: [
    {
      id: "primary",
      layerId: "primary_flow",
      segments: [{ pathId: "resident-flow", fromRoomTypes: ["lobby"], toRoomTypes: ["living_room", "bedroom", "corridor"] }]
    },
    {
      id: "staff",
      layerId: "staff_flow",
      segments: [{ pathId: "service-flow", fromRoomTypes: ["corridor"], toRoomTypes: ["kitchen", "bathroom"] }]
    },
    {
      id: "service",
      layerId: "service_flow",
      segments: [{ pathId: "utility-flow", fromRoomTypes: ["kitchen", "bathroom"], toRoomTypes: ["shaft", "equipment_room"] }]
    }
  ],
  analysisLayers: buildFlowAnalysisLayers({
    primary: "Resident flow",
    staff: "Unit circulation",
    service: "Utility flow"
  }),
  defaultAnalysisLayers: ["function_zones", "primary_flow", "daylight", "egress_path"],
  rulePack: residentialRulePack,
  programGoals: residentialGoals,
  defaultBrief: {
    projectType: "housing",
    description: "Multi-unit residential with daylight-focused living spaces",
    corePreference: "central core",
    orientationPreference: "south daylight"
  },
  defaultProgramSpaces: [
    { name: "Entry Lobby", roomType: "lobby", zone: "public", priority: "required" },
    { name: "Unit Corridor", roomType: "corridor", zone: "circulation", priority: "required" },
    { name: "Living Room", roomType: "living_room", zone: "private", priority: "preferred", needsDaylight: true },
    { name: "Bedroom", roomType: "bedroom", zone: "private", priority: "preferred", needsDaylight: true }
  ],
  exportPresets: [
    {
      id: "residential-unit-summary",
      label: "Unit area summary",
      includeLayers: ["function_zones", "daylight"],
      quantityGroupBy: "roomType"
    }
  ],
  topology: residentialTopology
};

export const schoolTypologyPack: TypologyPack = {
  id: "school",
  label: "School",
  aliases: ["school", "education", "campus"],
  roomTypes: ["lobby", "corridor", "office", "bathroom", "equipment_room", "shaft", "stair", "elevator", "other"],
  adjacencyRules: [
    { fromRoomTypes: ["other"], toRoomTypes: ["corridor"], relationship: "must" },
    { fromRoomTypes: ["office"], toRoomTypes: ["corridor"], relationship: "must" },
    { fromRoomTypes: ["bathroom"], toRoomTypes: ["shaft", "equipment_room"], relationship: "prefer" }
  ],
  flowDefinitions: [
    {
      id: "primary",
      layerId: "primary_flow",
      segments: [{ pathId: "student-flow", fromRoomTypes: ["lobby"], toRoomTypes: ["other", "corridor"] }]
    },
    {
      id: "staff",
      layerId: "staff_flow",
      segments: [{ pathId: "teacher-flow", fromRoomTypes: ["office"], toRoomTypes: ["other", "corridor"] }]
    },
    {
      id: "service",
      layerId: "service_flow",
      segments: [{ pathId: "service-flow", fromRoomTypes: ["equipment_room"], toRoomTypes: ["corridor", "shaft"] }]
    }
  ],
  analysisLayers: buildFlowAnalysisLayers({
    primary: "Student flow",
    staff: "Teacher flow",
    service: "Service flow"
  }),
  defaultAnalysisLayers: ["function_zones", "primary_flow", "staff_flow", "egress_path", "daylight"],
  rulePack: schoolRulePack,
  programGoals: schoolGoals,
  defaultBrief: {
    projectType: "education",
    description: "School building with clear student circulation and egress",
    corePreference: "central core",
    orientationPreference: "south daylight"
  },
  defaultProgramSpaces: [
    { name: "Main Entrance", roomType: "lobby", zone: "public", priority: "required", needsDaylight: true },
    { name: "Teaching Corridor", roomType: "corridor", zone: "circulation", priority: "required" },
    { name: "Classrooms", roomType: "other", zone: "private", priority: "preferred", needsDaylight: true },
    { name: "Staff Office", roomType: "office", zone: "semi_public", priority: "preferred" }
  ],
  exportPresets: [
    {
      id: "school-area-summary",
      label: "School area summary",
      includeLayers: ["function_zones", "primary_flow", "egress_path"],
      quantityGroupBy: "zone"
    }
  ],
  topology: schoolTopology
};

export const TYPOLOGY_PACKS: TypologyPack[] = [
  healthcareTypologyPack,
  officeTypologyPack,
  residentialTypologyPack,
  schoolTypologyPack
];

export const TYPOLOGY_PACK_BY_ID: Record<TypologyPack["id"], TypologyPack> = {
  healthcare: healthcareTypologyPack,
  office: officeTypologyPack,
  residential: residentialTypologyPack,
  school: schoolTypologyPack
};
