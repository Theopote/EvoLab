/**
 * Import/Trace module types and interfaces
 * Supports image, PDF, and DXF import for architectural plan tracing
 */

export type ImportSourceType = "image" | "pdf" | "dxf" | "sketch";

export interface ImportSource {
  id: string;
  type: ImportSourceType;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  base64?: string; // For image/PDF
  metadata?: ImportMetadata;
}

export interface ImportMetadata {
  width?: number;
  height?: number;
  dpi?: number;
  pageCount?: number; // For PDF
  selectedPage?: number; // For PDF
  unit?: "mm" | "m" | "ft" | "in";
  scale?: number; // pixels per unit
  rotation?: number; // degrees
}

export interface CalibrationPoint {
  pixel: [number, number];
  world: [number, number];
  label?: string;
}

export interface ImportCalibration {
  points: CalibrationPoint[];
  scale: number; // computed scale factor
  rotation: number; // computed rotation
  offset: [number, number]; // translation
  unit: "mm" | "m" | "ft" | "in";
}

export interface TracedElement {
  id: string;
  type: "wall" | "room" | "opening" | "reference";
  points: [number, number][];
  closed?: boolean;
  label?: string;
  confidence?: number; // AI detection confidence 0-1
}

export interface TraceResult {
  elements: TracedElement[];
  suggestedOutline?: [number, number][];
  detectionMethod: "manual" | "semi-auto" | "ai";
  timestamp: string;
}

export interface ImportSession {
  id: string;
  source: ImportSource;
  calibration?: ImportCalibration;
  trace?: TraceResult;
  status: "uploaded" | "calibrating" | "tracing" | "completed";
  createdAt: string;
  updatedAt: string;
}

// API request/response types

export interface UploadImportRequest {
  fileBase64: string;
  fileName: string;
  sourceType: ImportSourceType;
  selectedPage?: number; // For PDF
}

export interface UploadImportResponse {
  sessionId: string;
  source: ImportSource;
  metadata: ImportMetadata;
}

export interface CalibrateImportRequest {
  sessionId: string;
  points: CalibrationPoint[];
  unit: "mm" | "m" | "ft" | "in";
}

export interface CalibrateImportResponse {
  calibration: ImportCalibration;
  success: boolean;
}

export interface TraceImportRequest {
  sessionId: string;
  mode: "manual" | "semi-auto" | "ai";
  hints?: {
    expectedRoomCount?: number;
    buildingType?: string;
    includeOpenings?: boolean;
  };
}

export interface TraceImportResponse {
  trace: TraceResult;
  suggestedOutline?: [number, number][];
  warnings?: string[];
}

export interface ConvertToProjectRequest {
  sessionId: string;
  projectName: string;
  projectType: string;
  applyTrace: boolean;
}

export interface ConvertToProjectResponse {
  outline: [number, number][];
  rooms?: Array<{ polygon: [number, number][]; label?: string }>;
  success: boolean;
}
