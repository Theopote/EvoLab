"use client";

import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useMemo } from "react";
import type { PlanVersion, Room } from "@/lib/project-types";
import { getRoomMaterialSpec, modelPalette } from "@/components/viewer-3d/materials";
import { createWallSegments, getPolygonBounds, getPolygonCenter } from "@/components/viewer-3d/wallGeometry";

interface BuildingModelProps {
  version: PlanVersion;
}

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

export function BuildingModel({ version }: BuildingModelProps) {
  const outlineShape = useMemo(() => createRoomShape({ polygon: version.outline } as Room), [version.outline]);
  const outlineBounds = useMemo(() => getPolygonBounds(version.outline), [version.outline]);
  const offsetX = -(outlineBounds.minX + outlineBounds.maxX) / 2;
  const offsetZ = -(outlineBounds.minY + outlineBounds.maxY) / 2;

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow position={[0, 0, -0.08]}>
        <shapeGeometry args={[outlineShape]} />
        <meshStandardMaterial color={modelPalette.slab} opacity={0.22} transparent />
      </mesh>

      {version.rooms.map((room) => (
        <RoomMass key={room.id} room={room} />
      ))}
    </group>
  );
}

function RoomMass({ room }: { room: Room }) {
  const shape = useMemo(() => createRoomShape(room), [room]);
  const spec = getRoomMaterialSpec(room.type, room.zone);
  const roomHeight = Math.max(2.7, room.ceilingHeight + spec.heightBoost);
  const walls = useMemo(
    () => createWallSegments(room.polygon, roomHeight, room.type === "shaft" ? 0.42 : 0.24, room.id),
    [room.id, room.polygon, room.type, roomHeight]
  );
  const center = getPolygonCenter(room.polygon);

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <extrudeGeometry args={[shape, { depth: 0.14, bevelEnabled: false }]} />
        <meshStandardMaterial color={spec.color} opacity={spec.opacity} transparent side={THREE.DoubleSide} />
      </mesh>

      {walls.map((wall) => (
        <mesh
          castShadow
          key={wall.id}
          position={[wall.center[0], wall.center[2], -wall.center[1]]}
          rotation={[0, 0, wall.angle]}
        >
          <boxGeometry args={[wall.length, wall.thickness, wall.height]} />
          <meshStandardMaterial color={modelPalette.wall} opacity={0.56} transparent />
        </mesh>
      ))}

      <Text
        color="#dfe8ef"
        fontSize={1.2}
        anchorX="center"
        anchorY="middle"
        position={[center[0], center[1], -roomHeight - 0.35]}
        rotation={[0, 0, 0]}
      >
        {room.name}
      </Text>
    </group>
  );
}
