"use client";

import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useMemo } from "react";
import type { OpeningElement, PlanVersion, Room, Wall } from "@/lib/project-types";
import { getRoomMaterialSpec, modelPalette } from "@/components/viewer-3d/materials";
import { getPolygonBounds, getPolygonCenter } from "@/components/viewer-3d/wallGeometry";

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
  const level = version.levels[0];
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

      {level?.walls.map((wall) => (
        <BuildingWall key={wall.id} wall={wall} />
      ))}

      {level?.openings.map((opening) => (
        <OpeningMarker key={opening.id} opening={opening} />
      ))}
    </group>
  );
}

function RoomMass({ room }: { room: Room }) {
  const shape = useMemo(() => createRoomShape(room), [room]);
  const spec = getRoomMaterialSpec(room.type, room.zone);
  const roomHeight = Math.max(2.7, room.ceilingHeight + spec.heightBoost);
  const center = getPolygonCenter(room.polygon);

  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <extrudeGeometry args={[shape, { depth: 0.14, bevelEnabled: false }]} />
        <meshStandardMaterial color={spec.color} opacity={spec.opacity} transparent side={THREE.DoubleSide} />
      </mesh>

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

function BuildingWall({ wall }: { wall: Wall }) {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const color = wall.type === "core" ? "#a87534" : wall.type === "external" ? modelPalette.wall : "#738194";

  return (
    <mesh
      castShadow
      receiveShadow
      position={[(wall.start[0] + wall.end[0]) / 2, wall.height / 2, -(wall.start[1] + wall.end[1]) / 2]}
      rotation={[0, 0, angle]}
    >
      <boxGeometry args={[length, wall.thickness, wall.height]} />
      <meshStandardMaterial color={color} opacity={wall.type === "partition" ? 0.5 : 0.68} transparent />
    </mesh>
  );
}

function OpeningMarker({ opening }: { opening: OpeningElement }) {
  const color = opening.type === "door" ? "#4fb5c8" : opening.type === "window" ? "#84cc16" : "#e5edf5";
  const y = opening.type === "window" ? opening.sillHeight ?? 0.9 : 0.08;

  return (
    <mesh position={[opening.center[0], y, -opening.center[1]]}>
      <boxGeometry args={[opening.width, 0.12, Math.max(0.08, opening.height)]} />
      <meshStandardMaterial color={color} opacity={0.8} transparent />
    </mesh>
  );
}
