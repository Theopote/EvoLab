import { buildFlowAnalysisLayers } from "@/lib/typology/analysis-layers";
import type { TypologyPack } from "@/lib/typology/types";
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
  ]
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
  ]
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
  ]
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
  ]
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
