"use client";

import { Bvh, Environment, Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { PlanVersion } from "@/lib/project-types";
import { BuildingModel } from "@/components/viewer-3d/BuildingModel";
import { useInteractionStore } from "@/lib/interaction-store";

interface SceneProps {
  version?: PlanVersion;
}

export function Scene({ version }: SceneProps) {
  const view3d = useInteractionStore((state) => state.view3d);

  return (
    <div className="h-full min-h-[560px] overflow-hidden rounded border border-line bg-[#081018]">
      {version ? (
        <Canvas
          frameloop={view3d.frameloop}
          shadows
          camera={{ position: [32, 36, 46], fov: 42, near: 0.1, far: 1000 }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={["#081018"]} />
          <ambientLight intensity={0.6} />
          <directionalLight castShadow position={[24, 40, 16]} intensity={1.6} shadow-mapSize={[2048, 2048]} />
          {view3d.bvhEnabled ? (
            <Bvh firstHitOnly>
              <BuildingModel version={version} />
            </Bvh>
          ) : (
            <BuildingModel version={version} />
          )}
          <Grid
            args={[160, 160]}
            cellColor="#203040"
            cellSize={4}
            fadeDistance={130}
            fadeStrength={1.5}
            position={[0, -0.12, 0]}
            sectionColor="#355163"
            sectionSize={16}
          />
          <Environment preset="city" />
          <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
        </Canvas>
      ) : (
        <div className="grid h-full min-h-[560px] place-items-center text-sm text-muted">
          Select or generate a plan version to create the 3D model.
        </div>
      )}
    </div>
  );
}
