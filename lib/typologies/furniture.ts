import type { FurnitureCategory } from "@/lib/building-domain";
import type { TypologyPackId } from "@/lib/typology/types";
import { resolveTypologyPackId } from "@/lib/typology/resolve";

export interface FurniturePreset {
  id: string;
  name: string;
  category: FurnitureCategory;
  width: number;
  depth: number;
  roomTypes: string[];
}

const FURNITURE_LIBRARIES: Record<TypologyPackId, FurniturePreset[]> = {
  healthcare: [
    { id: "exam-table", name: "Exam table", category: "table", width: 1.8, depth: 0.7, roomTypes: ["consultation"] },
    { id: "waiting-chair", name: "Waiting chair", category: "chair", width: 0.6, depth: 0.6, roomTypes: ["lobby"] },
    { id: "nurse-station", name: "Nurse station", category: "desk", width: 1.6, depth: 0.8, roomTypes: ["corridor", "office"] }
  ],
  office: [
    { id: "workstation", name: "Workstation", category: "desk", width: 1.4, depth: 0.7, roomTypes: ["office"] },
    { id: "task-chair", name: "Task chair", category: "chair", width: 0.6, depth: 0.6, roomTypes: ["office"] },
    { id: "meeting-table", name: "Meeting table", category: "table", width: 2.4, depth: 1.1, roomTypes: ["office"] },
    { id: "reception-desk", name: "Reception desk", category: "desk", width: 2.0, depth: 0.8, roomTypes: ["lobby"] }
  ],
  residential: [
    { id: "sofa", name: "Sofa", category: "sofa", width: 2.0, depth: 0.9, roomTypes: ["living_room"] },
    { id: "dining-table", name: "Dining table", category: "table", width: 1.6, depth: 0.9, roomTypes: ["living_room", "kitchen"] },
    { id: "bed-double", name: "Double bed", category: "bed", width: 1.6, depth: 2.0, roomTypes: ["bedroom"] }
  ],
  school: [
    { id: "student-desk", name: "Student desk", category: "desk", width: 0.7, depth: 0.5, roomTypes: ["other"] },
    { id: "teacher-desk", name: "Teacher desk", category: "desk", width: 1.4, depth: 0.7, roomTypes: ["office", "other"] },
    { id: "lab-bench", name: "Lab bench", category: "table", width: 2.4, depth: 0.8, roomTypes: ["other", "equipment_room"] }
  ]
};

export function listFurniturePresets(projectType?: string): FurniturePreset[] {
  return FURNITURE_LIBRARIES[resolveTypologyPackId(projectType)];
}
