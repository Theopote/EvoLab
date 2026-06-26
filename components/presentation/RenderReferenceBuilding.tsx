"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { PlanVersion, Room } from "@/lib/project-types";
import { getRoomMaterialSpec } from "@/components/viewer-3d/materials";
import { getPolygonBounds } from "@/components/viewer-3d/wallGeometry";
import type { RenderReferenceCapturePass } from "@/lib/render-reference-capture-store";

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

function RoomCaptureMesh({
  room,
  mode
}: {
  room: Room;
  mode: RenderReferenceCapturePass;
}) {
  const spec = getRoomMaterialSpec(room.type, room.zone);
  const height = Math.max(2.7, room.ceilingHeight + spec.heightBoost);
  const shape = useMemo(() => createRoomShape(room), [room]);
  const geometry = useMemo(
    () =>
      new THREE.ExtrudeGeometry(shape, {
        depth: height,
        bevelEnabled: false
      }),
    [height, shape]
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 15), [geometry]);

  if (mode === "line") {
    return (
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#000000" />
      </lineSegments>
    );
  }

  return (
    <mesh geometry={geometry}>
      <meshDepthMaterial depthPacking={THREE.BasicDepthPacking} />
    </mesh>
  );
}

export function RenderReferenceBuilding({
  version,
  mode
}: {
  version: PlanVersion;
  mode: RenderReferenceCapturePass;
}) {
  const outlineBounds = useMemo(() => getPolygonBounds(version.outline), [version.outline]);
  const offsetX = -(outlineBounds.minX + outlineBounds.maxX) / 2;
  const offsetZ = -(outlineBounds.minY + outlineBounds.maxY) / 2;

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      {version.rooms.map((room) => (
        <RoomCaptureMesh key={room.id} mode={mode} room={room} />
      ))}
    </group>
  );
}
