"use client";

import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";
import {
  getGridColumnPositions,
  shouldRenderRoomLabels
} from "@/lib/viewer-3d/building-model-utils";
import { useBuildingModelSource } from "@/lib/viewer-3d/use-building-model-source";
import { getRoomExplodeOffset } from "@/lib/viewer-3d/explode-utils";
import { useInteractionStore } from "@/lib/interaction-store";
import { getRoomMaterialSpec, type RoomMaterialSpec, modelPalette } from "@/components/viewer-3d/materials";
import { getPolygonBounds, getPolygonCenter } from "@/components/viewer-3d/wallGeometry";

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

export function BuildingModel() {
  const source = useBuildingModelSource();

  if (!source) {
    return null;
  }

  return <BuildingModelContent key={source.geometryRevision} version={source.version} />;
}

function BuildingModelContent({ version }: { version: PlanVersion }) {
  const explodeFactor = useInteractionStore((state) => state.explodeFactor);
  const outlineShape = useMemo(() => createRoomShape({ polygon: version.outline } as Room), [version.outline]);
  const outlineBounds = useMemo(() => getPolygonBounds(version.outline), [version.outline]);
  const level = version.levels[0];
  const offsetX = -(outlineBounds.minX + outlineBounds.maxX) / 2;
  const offsetZ = -(outlineBounds.minY + outlineBounds.maxY) / 2;
  const showLabels = shouldRenderRoomLabels(version.rooms.length);
  const columnPositions = useMemo(() => getGridColumnPositions(version), [version]);

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh receiveShadow position={[0, 0, -0.08]}>
        <shapeGeometry args={[outlineShape]} />
        <meshStandardMaterial color={modelPalette.slab} opacity={0.22} transparent />
      </mesh>

      <RoomMassMeshes rooms={version.rooms} buildingOutline={version.outline} explodeFactor={explodeFactor} />
      {showLabels ? (
        <RoomLabels rooms={version.rooms} buildingOutline={version.outline} explodeFactor={explodeFactor} />
      ) : null}
      {!showLabels ? <RoomCountLabel count={version.rooms.length} bounds={outlineBounds} /> : null}

      <InstancedWalls walls={level?.walls ?? []} />
      <InstancedOpenings openings={level?.openings ?? []} />
      <InstancedGridColumns positions={columnPositions} levelHeight={level?.height ?? 3.2} />
    </group>
  );
}

function getRoomMaterialKey(spec: RoomMaterialSpec) {
  return `${spec.color}:${spec.opacity}:${spec.heightBoost}`;
}

function RoomMassMeshes({
  rooms,
  buildingOutline,
  explodeFactor
}: {
  rooms: Room[];
  buildingOutline: Point[];
  explodeFactor: number;
}) {
  const roomGroups = useMemo(() => {
    const groups = new Map<string, { spec: RoomMaterialSpec; shapes: THREE.Shape[] }>();

    rooms.forEach((room) => {
      const spec = getRoomMaterialSpec(room.type, room.zone);
      const key = getRoomMaterialKey(spec);
      const group = groups.get(key);

      if (group) {
        group.shapes.push(createRoomShape(room));
      } else {
        groups.set(key, { spec, shapes: [createRoomShape(room)] });
      }
    });

    return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
  }, [rooms]);

  if (explodeFactor > 0) {
    return (
      <>
        {rooms.map((room) => {
          const spec = getRoomMaterialSpec(room.type, room.zone);
          const [offsetX, offsetY] = getRoomExplodeOffset(room.polygon, buildingOutline, explodeFactor);

          return (
            <mesh key={room.id} castShadow receiveShadow position={[offsetX, offsetY, 0]}>
              <extrudeGeometry args={[createRoomShape(room), { depth: 0.14, bevelEnabled: false }]} />
              <meshStandardMaterial color={spec.color} opacity={spec.opacity} transparent side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </>
    );
  }

  return (
    <>
      {roomGroups.map(({ key, shapes, spec }) => (
        <mesh key={key} castShadow receiveShadow position={[0, 0, 0]}>
          <extrudeGeometry args={[shapes, { depth: 0.14, bevelEnabled: false }]} />
          <meshStandardMaterial color={spec.color} opacity={spec.opacity} transparent side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function RoomLabels({
  rooms,
  buildingOutline,
  explodeFactor
}: {
  rooms: Room[];
  buildingOutline: Point[];
  explodeFactor: number;
}) {
  return (
    <>
      {rooms.map((room) => {
        const spec = getRoomMaterialSpec(room.type, room.zone);
        const roomHeight = Math.max(2.7, room.ceilingHeight + spec.heightBoost);
        const center = getPolygonCenter(room.polygon);
        const [offsetX, offsetY] = getRoomExplodeOffset(room.polygon, buildingOutline, explodeFactor);

        return (
          <Text
            key={room.id}
            color="#dfe8ef"
            fontSize={1.2}
            anchorX="center"
            anchorY="middle"
            position={[center[0] + offsetX, center[1] + offsetY, -roomHeight - 0.35]}
            rotation={[0, 0, 0]}
          >
            {room.name}
          </Text>
        );
      })}
    </>
  );
}

function RoomCountLabel({
  count,
  bounds
}: {
  count: number;
  bounds: ReturnType<typeof getPolygonBounds>;
}) {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return (
    <Text color="#94a3b8" fontSize={1.6} anchorX="center" anchorY="middle" position={[centerX, centerY, -4.5]}>
      {`${count} rooms (labels hidden for performance)`}
    </Text>
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
        typedWalls.length ? <InstancedWallGroup key={type} type={type} walls={typedWalls} /> : null
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

      object.position.set((wall.start[0] + wall.end[0]) / 2, wall.height / 2, -(wall.start[1] + wall.end[1]) / 2);
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
        typedOpenings.length ? <InstancedOpeningGroup key={type} openings={typedOpenings} type={type} /> : null
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
      const y = opening.type === "window" ? (opening.sillHeight ?? 0.9) : 0.08;

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

function InstancedGridColumns({
  positions,
  levelHeight
}: {
  positions: Array<[number, number]>;
  levelHeight: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current || positions.length === 0) {
      return;
    }

    const object = new THREE.Object3D();
    const columnSize = 0.45;

    positions.forEach(([x, y], index) => {
      object.position.set(x, levelHeight / 2, -y);
      object.rotation.set(0, 0, 0);
      object.scale.set(columnSize, levelHeight, columnSize);
      object.updateMatrix();
      ref.current?.setMatrixAt(index, object.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  }, [levelHeight, positions]);

  if (positions.length === 0) {
    return null;
  }

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#64748b" opacity={0.55} transparent />
    </instancedMesh>
  );
}
