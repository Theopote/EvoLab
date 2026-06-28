/**
 * Import/Trace Module - Zustand Store
 * Manages state for importing images, PDFs, and DXF files
 */

import { create } from "zustand";
import type {
  ImportSession,
  ImportSource,
  ImportCalibration,
  TraceResult,
  CalibrationPoint,
  ImportSourceType
} from "@/lib/import-types";

interface ImportState {
  // Current session
  session: ImportSession | null;

  // UI state
  currentStep: "upload" | "calibrate" | "trace" | "convert";
  isProcessing: boolean;
  error: string | null;

  // Calibration state
  calibrationPoints: CalibrationPoint[];
  calibrationUnit: "mm" | "m" | "ft" | "in";

  // Trace state
  traceMode: "manual" | "semi-auto" | "ai";
  manualElements: Array<{ id: string; points: [number, number][]; type: string }>;

  // Actions
  setSession: (session: ImportSession | null) => void;
  setCurrentStep: (step: ImportState["currentStep"]) => void;
  setIsProcessing: (processing: boolean) => void;
  setError: (error: string | null) => void;

  addCalibrationPoint: (point: CalibrationPoint) => void;
  removeCalibrationPoint: (index: number) => void;
  clearCalibrationPoints: () => void;
  setCalibrationUnit: (unit: ImportState["calibrationUnit"]) => void;

  setTraceMode: (mode: ImportState["traceMode"]) => void;
  addManualElement: (element: ImportState["manualElements"][0]) => void;
  removeManualElement: (id: string) => void;
  clearManualElements: () => void;

  reset: () => void;
}

const initialState = {
  session: null,
  currentStep: "upload" as const,
  isProcessing: false,
  error: null,
  calibrationPoints: [],
  calibrationUnit: "mm" as const,
  traceMode: "manual" as const,
  manualElements: []
};

export const useImportStore = create<ImportState>((set) => ({
  ...initialState,

  setSession: (session) => set({ session }),
  setCurrentStep: (step) => set({ currentStep: step }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setError: (error) => set({ error }),

  addCalibrationPoint: (point) =>
    set((state) => ({
      calibrationPoints: [...state.calibrationPoints, point]
    })),

  removeCalibrationPoint: (index) =>
    set((state) => ({
      calibrationPoints: state.calibrationPoints.filter((_, i) => i !== index)
    })),

  clearCalibrationPoints: () => set({ calibrationPoints: [] }),

  setCalibrationUnit: (unit) => set({ calibrationUnit: unit }),

  setTraceMode: (mode) => set({ traceMode: mode }),

  addManualElement: (element) =>
    set((state) => ({
      manualElements: [...state.manualElements, element]
    })),

  removeManualElement: (id) =>
    set((state) => ({
      manualElements: state.manualElements.filter((el) => el.id !== id)
    })),

  clearManualElements: () => set({ manualElements: [] }),

  reset: () => set(initialState)
}));
