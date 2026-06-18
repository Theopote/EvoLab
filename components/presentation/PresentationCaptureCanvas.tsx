"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { BuildingModel } from "@/components/viewer-3d/BuildingModel";
import { SiteContextBuildings, SiteEnvelopeMesh } from "@/components/viewer-3d/SiteContextScene";
import type { PresentationCaptureImage } from "@/lib/presentation-capture-store";
import { usePresentationCaptureStore } from "@/lib/presentation-capture-store";

const CAPTURE_VIEWS = [
  { id: "iso", label: "Isometric", position: [42, 36, 42] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: "eye", label: "Eye Level", position: [0, 18, 52] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: "plan", label: "Plan View", position: [0.1, 58, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
];

function CaptureRig() {
  const { gl, camera, scene } = useThree();
  const completeCapture = usePresentationCaptureStore((state) => state.completeCapture);
  const failCapture = usePresentationCaptureStore((state) => state.failCapture);
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
      try {
        await waitFrames(4);
        const images: PresentationCaptureImage[] = [];

        for (const view of CAPTURE_VIEWS) {
          if (cancelled) {
            return;
          }

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
  }, [camera, completeCapture, failCapture, gl, scene]);

  return null;
}

export function PresentationCaptureCanvas() {
  const status = usePresentationCaptureStore((state) => state.status);

  if (status !== "capturing") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed -left-[9999px] top-0 h-[720px] w-[1280px] overflow-hidden opacity-0">
      <Canvas
        frameloop="always"
        shadows
        camera={{ position: [42, 36, 42], fov: 42, near: 0.1, far: 1000 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        style={{ width: 1280, height: 720 }}
      >
        <color attach="background" args={["#081018"]} />
        <ambientLight intensity={0.65} />
        <directionalLight castShadow position={[24, 40, 16]} intensity={1.6} />
        <SiteEnvelopeMesh />
        <SiteContextBuildings />
        <BuildingModel />
        <Environment preset="city" />
        <CaptureRig />
      </Canvas>
    </div>
  );
}
