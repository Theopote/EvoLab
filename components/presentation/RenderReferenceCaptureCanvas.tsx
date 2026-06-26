"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { RenderReferenceBuilding } from "@/components/presentation/RenderReferenceBuilding";
import { captureSceneDepthDataUrl } from "@/lib/presentation/capture-scene-depth";
import {
  buildRenderCaptureView,
  RENDER_CAPTURE_HEIGHT,
  RENDER_CAPTURE_WIDTH
} from "@/lib/presentation/render-capture-views";
import type { PlanVersion } from "@/lib/project-types";
import {
  useRenderReferenceCaptureStore,
  type RenderReferenceCapturePass
} from "@/lib/render-reference-capture-store";

function CaptureBackground({ mode }: { mode: RenderReferenceCapturePass }) {
  return <color attach="background" args={[mode === "line" ? "#ffffff" : "#000000"]} />;
}

function CaptureRig({
  spanMeters,
  cameraView,
  modes
}: {
  spanMeters: number;
  cameraView: string;
  modes: RenderReferenceCapturePass[];
}) {
  const { gl, camera, scene } = useThree();
  const completeCapture = useRenderReferenceCaptureStore((state) => state.completeCapture);
  const failCapture = useRenderReferenceCaptureStore((state) => state.failCapture);
  const setCapturePass = useRenderReferenceCaptureStore((state) => state.setCapturePass);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;
    let cancelled = false;

    async function waitFrames(count: number) {
      for (let index = 0; index < count; index += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    }

    async function runCapture() {
      const view = buildRenderCaptureView(cameraView, spanMeters);

      try {
        await waitFrames(6);
        camera.position.set(view.position[0], view.position[1], view.position[2]);
        camera.lookAt(view.target[0], view.target[1], view.target[2]);
        camera.updateProjectionMatrix();

        const results: { depth?: string; line?: string } = {};

        for (const mode of modes) {
          if (cancelled) {
            return;
          }

          setCapturePass(mode);
          await waitFrames(4);

          camera.position.set(view.position[0], view.position[1], view.position[2]);
          camera.lookAt(view.target[0], view.target[1], view.target[2]);
          camera.updateProjectionMatrix();

          if (mode === "depth") {
            results.depth = captureSceneDepthDataUrl(gl, scene, camera, RENDER_CAPTURE_WIDTH, RENDER_CAPTURE_HEIGHT);
          } else {
            gl.render(scene, camera);
            results.line = gl.domElement.toDataURL("image/png");
          }
        }

        if (!cancelled) {
          completeCapture(results);
        }
      } catch (error) {
        if (!cancelled) {
          failCapture(error instanceof Error ? error.message : "Failed to export render references.");
        }
      }
    }

    void runCapture();

    return () => {
      cancelled = true;
    };
  }, [camera, cameraView, completeCapture, failCapture, gl, modes, scene, setCapturePass, spanMeters]);

  return null;
}

export function RenderReferenceCaptureCanvas({ activeVersion }: { activeVersion?: PlanVersion }) {
  const status = useRenderReferenceCaptureStore((state) => state.status);
  const request = useRenderReferenceCaptureStore((state) => state.request);
  const capturePass = useRenderReferenceCaptureStore((state) => state.capturePass);

  if (status !== "capturing" || !activeVersion || !request || !capturePass) {
    return null;
  }

  const span = Math.max(activeVersion.overallBounds.width, activeVersion.overallBounds.height);
  const initialView = buildRenderCaptureView(request.cameraView, span);

  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 h-[720px] w-[1280px] overflow-hidden opacity-0">
      <Canvas
        frameloop="always"
        camera={{
          position: initialView.position,
          fov: 42,
          near: 0.1,
          far: Math.max(span * 8, 1000)
        }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ width: RENDER_CAPTURE_WIDTH, height: RENDER_CAPTURE_HEIGHT }}
      >
        <CaptureBackground mode={capturePass} />
        <RenderReferenceBuilding key={capturePass} mode={capturePass} version={activeVersion} />
        <CaptureRig cameraView={request.cameraView} modes={request.modes} spanMeters={span} />
      </Canvas>
    </div>
  );
}
