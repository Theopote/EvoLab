"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PresentationCaptureBuilding } from "@/components/presentation/PresentationCaptureBuilding";
import { SceneEnvironment } from "@/components/viewer-3d/SceneEnvironment";
import { SiteContextBuildings, SiteEnvelopeMesh } from "@/components/viewer-3d/SiteContextScene";
import { buildCaptureViews } from "@/lib/presentation/capture-views";
import type { PresentationCaptureImage } from "@/lib/presentation-capture-store";
import { usePresentationCaptureStore } from "@/lib/presentation-capture-store";
import { useProjectState } from "@/lib/project-store";

function CaptureRig({ spanMeters }: { spanMeters: number }) {
  const { gl, camera, scene } = useThree();
  const completeCapture = usePresentationCaptureStore((state) => state.completeCapture);
  const failCapture = usePresentationCaptureStore((state) => state.failCapture);
  const setExplodeFactor = usePresentationCaptureStore((state) => state.setExplodeFactor);
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
      const views = buildCaptureViews(spanMeters);

      try {
        await waitFrames(6);
        const images: PresentationCaptureImage[] = [];

        for (const view of views) {
          if (cancelled) {
            return;
          }

          setExplodeFactor(view.explodeFactor);
          await waitFrames(view.explodeFactor > 0 ? 4 : 2);

          camera.position.set(view.position[0], view.position[1], view.position[2]);
          camera.lookAt(view.target[0], view.target[1], view.target[2]);
          camera.updateProjectionMatrix();
          gl.render(scene, camera);
          images.push({
            id: view.id,
            label: view.label,
            dataUrl: gl.domElement.toDataURL("image/png")
          });
        }

        if (!cancelled) {
          completeCapture(images);
        }
      } catch (error) {
        if (!cancelled) {
          failCapture(error instanceof Error ? error.message : "Failed to capture 3D views.");
        }
      }
    }

    void runCapture();

    return () => {
      cancelled = true;
    };
  }, [camera, completeCapture, failCapture, gl, scene, setExplodeFactor, spanMeters]);

  return null;
}

export function PresentationCaptureCanvas() {
  const status = usePresentationCaptureStore((state) => state.status);
  const activeVersion = useProjectState((state) => state.activeVersion);

  if (status !== "capturing" || !activeVersion) {
    return null;
  }

  const span = Math.max(activeVersion.overallBounds.width, activeVersion.overallBounds.height);
  const initialView = buildCaptureViews(span)[0];

  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 h-[720px] w-[1280px] overflow-hidden opacity-0">
      <Canvas
        frameloop="always"
        shadows
        camera={{
          position: initialView.position,
          fov: 42,
          near: 0.1,
          far: Math.max(span * 8, 1000)
        }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ width: 1280, height: 720 }}
      >
        <color attach="background" args={["#081018"]} />
        <ambientLight intensity={0.65} />
        <directionalLight castShadow position={[24, 40, 16]} intensity={1.6} />
        <SiteEnvelopeMesh />
        <SiteContextBuildings />
        <PresentationCaptureBuilding version={activeVersion} />
        <SceneEnvironment />
        <CaptureRig spanMeters={span} />
      </Canvas>
    </div>
  );
}
