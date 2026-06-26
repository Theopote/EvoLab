"use client";

import { Bvh, Grid } from "@react-three/drei";
import { CadViewControls } from "@/components/viewer-3d/CadViewControls";
import { Canvas } from "@react-three/fiber";
import { BuildingModel } from "@/components/viewer-3d/BuildingModel";
import { SceneEnvironment } from "@/components/viewer-3d/SceneEnvironment";
import { SiteContextBuildings, SiteEnvelopeMesh } from "@/components/viewer-3d/SiteContextScene";
import { useHasBuildingModel } from "@/lib/viewer-3d/use-building-model-source";
import { useInteractionStore } from "@/lib/interaction-store";

export function Scene() {
  const hasVersion = useHasBuildingModel();
  const view3d = useInteractionStore((state) => state.view3d);

  return (
    <div
      className="h-full min-h-[560px] overflow-hidden rounded border border-line bg-[#081018]"
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasVersion ? (
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
              <SiteEnvelopeMesh />
              <SiteContextBuildings />
              <BuildingModel />
            </Bvh>
          ) : (
            <>
              <SiteEnvelopeMesh />
              <SiteContextBuildings />
              <BuildingModel />
            </>
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
          <SceneEnvironment />
          <CadViewControls />
        </Canvas>
      ) : (
        <div className="grid h-full min-h-[560px] place-items-center text-sm text-muted">
          Select or generate a plan version to create the 3D model.
        </div>
      )}
    </div>
  );
}
