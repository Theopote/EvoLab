import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import type { OpeningElement, PlanVersion, Room, Wall } from "@/lib/project-types";
import { getRoomMaterialSpec } from "@/components/viewer-3d/materials";
import { getPolygonBounds } from "@/components/viewer-3d/wallGeometry";

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

function addWalls(group: THREE.Group, walls: Wall[]) {
  walls.forEach((wall) => {
    const length = Math.max(0.01, Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]));
    const angle = Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, wall.height, wall.thickness),
      new THREE.MeshStandardMaterial({
        color: wall.type === "external" ? "#9fb3c8" : wall.type === "core" ? "#a87534" : "#738194",
        opacity: 0.72,
        transparent: true
      })
    );
    mesh.position.set((wall.start[0] + wall.end[0]) / 2, wall.height / 2, -(wall.start[1] + wall.end[1]) / 2);
    mesh.rotation.y = angle;
    mesh.name = wall.id;
    group.add(mesh);
  });
}

function addOpenings(group: THREE.Group, openings: OpeningElement[]) {
  openings.forEach((opening) => {
    const color = opening.type === "door" ? "#4fb5c8" : opening.type === "window" ? "#84cc16" : "#e5edf5";
    const y = opening.type === "window" ? (opening.sillHeight ?? 0.9) : 0.08;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(opening.width, Math.max(0.08, opening.height), 0.12),
      new THREE.MeshStandardMaterial({ color, opacity: 0.85, transparent: true })
    );
    mesh.position.set(opening.center[0], y, -opening.center[1]);
    mesh.name = opening.id;
    group.add(mesh);
  });
}

export function buildGltfGroup(version: PlanVersion) {
  const group = new THREE.Group();
  group.name = version.label;
  const outlineBounds = getPolygonBounds(version.outline);
  const offsetX = -(outlineBounds.minX + outlineBounds.maxX) / 2;
  const offsetZ = -(outlineBounds.minY + outlineBounds.maxY) / 2;
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  root.position.set(offsetX, 0, offsetZ);

  const slab = new THREE.Mesh(
    new THREE.ShapeGeometry(createRoomShape({ polygon: version.outline } as Room)),
    new THREE.MeshStandardMaterial({ color: "#1f2937", opacity: 0.25, transparent: true })
  );
  slab.position.z = -0.08;
  root.add(slab);

  version.rooms.forEach((room) => {
    const spec = getRoomMaterialSpec(room.type, room.zone);
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(createRoomShape(room), { depth: 0.14, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: spec.color, opacity: spec.opacity, transparent: true, side: THREE.DoubleSide })
    );
    mesh.name = room.id;
    root.add(mesh);
  });

  const level = version.levels[0];
  addWalls(root, level?.walls ?? []);
  addOpenings(root, level?.openings ?? []);
  group.add(root);
  return group;
}

export async function exportGltfBinary(version: PlanVersion): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const group = buildGltfGroup(version);

  return new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
          return;
        }

        reject(new Error("GLTFExporter did not return a binary buffer."));
      },
      (error) => reject(error instanceof Error ? error : new Error("Failed to export glTF.")),
      { binary: true }
    );
  });
}

export async function downloadGltfModel(version: PlanVersion) {
  const buffer = await exportGltfBinary(version);
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${version.id}.glb`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
