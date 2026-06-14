"use client";

import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
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

const wallTypes: Wall["type"][] = ["external", "internal", "partition", "core"];
const openingTypes: OpeningElement["type"][] = ["door", "window", "opening"];

const wallMaterialSpec: Record<Wall["type"], { color: string; opacity: number }> = {
  external: { color: modelPalette.wall, opacity: 0.72 },
  internal: { color: "#738194", opacity: 0.64 },
  partition: { color: "#738194", opacity: 0.5 },
  core: { color: "#a87534", opacity: 0.78 }
};

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

      <InstancedWalls walls={level?.walls ?? []} />
      <InstancedOpenings openings={level?.openings ?? []} />
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

function InstancedWalls({ walls }: { walls: Wall[] }) {
  const groupedWalls = useMemo(
    () =>
      wallTypes.map((type) => ({
        type,
        walls: walls.filter((wall) => wall.type === type)
      })),
    [walls]
  );

  return (
    <>
      {groupedWalls.map(({ type, walls: typedWalls }) =>
        typedWalls.length ? (
          <InstancedWallGroup key={type} type={type} walls={typedWalls} />
        ) : null
      )}
    </>
  );
}

function InstancedWallGroup({ type, walls }: { type: Wall["type"]; walls: Wall[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const material = wallMaterialSpec[type];

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    const object = new THREE.Object3D();

    walls.forEach((wall, index) => {
      const dx = wall.end[0] - wall.start[0];
      const dy = wall.end[1] - wall.start[1];
      const length = Math.max(0.01, Math.hypot(dx, dy));
      const angle = Math.atan2(dy, dx);

      object.position.set(
        (wall.start[0] + wall.end[0]) / 2,
        wall.height / 2,
        -(wall.start[1] + wall.end[1]) / 2
      );
      object.rotation.set(0, 0, angle);
      object.scale.set(length, wall.thickness, wall.height);
      object.updateMatrix();
      ref.current?.setMatrixAt(index, object.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [walls]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, walls.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={material.color} opacity={material.opacity} transparent />
    </instancedMesh>
  );
}

function InstancedOpenings({ openings }: { openings: OpeningElement[] }) {
  const groupedOpenings = useMemo(
    () =>
      openingTypes.map((type) => ({
        type,
        openings: openings.filter((opening) => opening.type === type)
      })),
    [openings]
  );

  return (
    <>
      {groupedOpenings.map(({ type, openings: typedOpenings }) =>
        typedOpenings.length ? (
          <InstancedOpeningGroup key={type} openings={typedOpenings} type={type} />
        ) : null
      )}
    </>
  );
}

function InstancedOpeningGroup({
  openings,
  type
}: {
  openings: OpeningElement[];
  type: OpeningElement["type"];
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const color = type === "door" ? "#4fb5c8" : type === "window" ? "#84cc16" : "#e5edf5";

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    const object = new THREE.Object3D();

    openings.forEach((opening, index) => {
      const y = opening.type === "window" ? opening.sillHeight ?? 0.9 : 0.08;

      object.position.set(opening.center[0], y, -opening.center[1]);
      object.rotation.set(0, 0, 0);
      object.scale.set(opening.width, 0.12, Math.max(0.08, opening.height));
      object.updateMatrix();
      ref.current?.setMatrixAt(index, object.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [openings]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, openings.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} opacity={0.8} transparent />
    </instancedMesh>
  );
}
