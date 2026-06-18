"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { PlanVersion, Room } from "@/lib/project-types";
import { getRoomMaterialSpec } from "@/components/viewer-3d/materials";
import { getPolygonBounds } from "@/components/viewer-3d/wallGeometry";
import { usePresentationCaptureStore } from "@/lib/presentation-capture-store";

function createRoomShape(room: Room) {
  const shape = new THREE.Shape();
  room.polygon.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();
  return shape;
}

export function PresentationCaptureBuilding({ version }: { version: PlanVersion }) {
  const explodeFactor = usePresentationCaptureStore((state) => state.explodeFactor);
  const outlineBounds = useMemo(() => getPolygonBounds(version.outline), [version.outline]);
  const offsetX = -(outlineBounds.minX + outlineBounds.maxX) / 2;
  const offsetZ = -(outlineBounds.minY + outlineBounds.maxY) / 2;
  const centerX = (outlineBounds.minX + outlineBounds.maxX) / 2;
  const centerY = (outlineBounds.minY + outlineBounds.maxY) / 2;

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      {version.rooms.map((room) => {
        const bounds = getPolygonBounds(room.polygon);
        const roomCenterX = (bounds.minX + bounds.maxX) / 2;
        const roomCenterY = (bounds.minY + bounds.maxY) / 2;
        const vectorX = (roomCenterX - centerX) * 0.38 * explodeFactor;
        const vectorY = (roomCenterY - centerY) * 0.38 * explodeFactor;
        const spec = getRoomMaterialSpec(room.type, room.zone);
        const height = Math.max(2.7, room.ceilingHeight + spec.heightBoost);
        const shape = createRoomShape(room);

        return (
          <mesh key={room.id} castShadow receiveShadow position={[vectorX, vectorY, 0]}>
            <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
            <meshStandardMaterial color={spec.color} opacity={spec.opacity} transparent side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}
