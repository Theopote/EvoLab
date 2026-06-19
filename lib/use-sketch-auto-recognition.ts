"use client";

import { useEffect, useRef } from "react";
import type { PlanVersion } from "@/lib/project-types";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import {
  ghostLoopsSignature,
  recognizeSketchInput,
  SKETCH_AUTO_RECOGNIZE_DELAY_MS,
  type SketchRecognitionResult
} from "@/lib/sketch-recognition";
import { useSketchInputStore } from "@/lib/sketch-input-store";

interface UseSketchAutoRecognitionOptions {
  version?: PlanVersion;
  enabled: boolean;
  onRecognized: (result: SketchRecognitionResult & { auto: boolean }) => void;
  onRecognizingChange?: (isRecognizing: boolean) => void;
  onError?: (message: string) => void;
}

export function useSketchAutoRecognition({
  version,
  enabled,
  onRecognized,
  onRecognizingChange,
  onError
}: UseSketchAutoRecognitionOptions) {
  const strokes = useSketchInputStore((state) => state.strokes);
  const ghostLoops = useSketchInputStore((state) => state.ghostLoops);
  const activeStroke = useSketchInputStore((state) => state.activeStroke);
  const strokeEpoch = useSketchInputStore((state) => state.strokeEpoch);
  const recognitionGeneration = useSketchInputStore((state) => state.recognitionGeneration);
  const setSemanticRooms = useSketchInputStore((state) => state.setSemanticRooms);
  const setRecognitionStatus = useSketchInputStore((state) => state.setRecognitionStatus);

  const onRecognizedRef = useRef(onRecognized);
  const onRecognizingChangeRef = useRef(onRecognizingChange);
  const onErrorRef = useRef(onError);
  const abortRef = useRef<AbortController | null>(null);
  const lastRecognizedSignatureRef = useRef("");

  onRecognizedRef.current = onRecognized;
  onRecognizingChangeRef.current = onRecognizingChange;
  onErrorRef.current = onError;

  useEffect(() => {
    if (ghostLoops.length === 0) {
      lastRecognizedSignatureRef.current = "";
    }
  }, [ghostLoops.length]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setRecognitionStatus("idle");
      onRecognizingChangeRef.current?.(false);
      return;
    }

    const signature = ghostLoopsSignature(ghostLoops);
    const isDrawing = activeStroke.length > 0;

    if (!version || ghostLoops.length === 0 || isDrawing) {
      return;
    }

    if (signature === lastRecognizedSignatureRef.current) {
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      if (useSketchInputStore.getState().activeStroke.length > 0) {
        return;
      }

      const generationAtStart = useSketchInputStore.getState().recognitionGeneration;
      const loopsAtStart = useSketchInputStore.getState().ghostLoops;
      const strokesAtStart = useSketchInputStore.getState().strokes;
      const signatureAtStart = ghostLoopsSignature(loopsAtStart);

      if (!version || loopsAtStart.length === 0 || signatureAtStart === lastRecognizedSignatureRef.current) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setRecognitionStatus("recognizing");
      onRecognizingChangeRef.current?.(true);

      void recognizeSketchInput({
        version,
        strokes: strokesAtStart,
        ghostLoops: loopsAtStart,
        signal: controller.signal
      })
        .then((result) => {
          if (controller.signal.aborted) {
            return;
          }

          if (useSketchInputStore.getState().recognitionGeneration !== generationAtStart) {
            return;
          }

          if (ghostLoopsSignature(useSketchInputStore.getState().ghostLoops) !== signatureAtStart) {
            return;
          }

          lastRecognizedSignatureRef.current = signatureAtStart;
          setSemanticRooms(result.recognizedRooms);
          setRecognitionStatus("ready");
          onRecognizedRef.current({ ...result, auto: true });
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }

          setRecognitionStatus("error");
          const message = error instanceof Error ? error.message : "Sketch auto-recognition failed.";
          onErrorRef.current?.(message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            onRecognizingChangeRef.current?.(false);
          }
        });
    }, SKETCH_AUTO_RECOGNIZE_DELAY_MS);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [
    activeStroke.length,
    enabled,
    ghostLoops,
    recognitionGeneration,
    setRecognitionStatus,
    setSemanticRooms,
    strokeEpoch,
    strokes,
    version
  ]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
}
