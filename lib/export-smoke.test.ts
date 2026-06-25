import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { initialProjectData } from "@/lib/evolab-data";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import { buildGltfGroup } from "@/lib/export-gltf";
import { buildPlanPrintHtml } from "@/lib/export-plan-pdf";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";

const baseVersion = initialProjectData.versions[0]!;

describe("export smoke tests", () => {
  it("builds a gltf scene graph for the active scheme", () => {
    const group = buildGltfGroup(baseVersion);

    expect(group.name).toBe(baseVersion.label);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("builds exportable mesh geometry in the gltf group", () => {
    const group = buildGltfGroup(baseVersion);
    let meshCount = 0;

    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshCount += 1;
      }
    });

    expect(meshCount).toBeGreaterThan(0);
  });

  it("builds printable plan html with svg markup", () => {
    const totalArea = baseVersion.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
    const html = buildPlanPrintHtml(baseVersion, totalArea);

    expect(html).toContain("<svg");
    expect(html).toContain(baseVersion.label);
    expect(html).toContain(`${baseVersion.rooms.length} rooms`);
  });

  it("creates ifc export payload with storeys and spaces", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const payload = createIfcExportPayload(expanded);

    expect(payload.storeys.length).toBe(4);
    expect(payload.storeys.every((storey) => storey.spaces.length > 0)).toBe(true);
    expect(payload.project.name.length).toBeGreaterThan(0);
  });
});
