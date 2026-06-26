import * as THREE from "three";
import { depthRgbaToDataUrl } from "@/lib/presentation/depth-map";

export function captureSceneDepthDataUrl(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number
): string {
  const renderTarget = new THREE.WebGLRenderTarget(width, height);
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.BasicDepthPacking
  });
  const materialBackups = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const visibilityBackups = new Map<THREE.Object3D, boolean>();

  scene.traverse((object) => {
    if (object instanceof THREE.LineSegments || object instanceof THREE.Line) {
      visibilityBackups.set(object, object.visible);
      object.visible = false;
      return;
    }

    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    materialBackups.set(object, object.material);
    object.material = depthMaterial;
  });

  gl.setRenderTarget(renderTarget);
  gl.render(scene, camera);

  const pixels = new Uint8Array(width * height * 4);
  gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, pixels);

  materialBackups.forEach((material, mesh) => {
    mesh.material = material;
  });
  visibilityBackups.forEach((visible, object) => {
    object.visible = visible;
  });

  gl.setRenderTarget(null);
  renderTarget.dispose();
  depthMaterial.dispose();

  return depthRgbaToDataUrl(pixels, width, height);
}
