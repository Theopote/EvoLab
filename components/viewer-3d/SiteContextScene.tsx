"use client";

import * as THREE from "three";
import { useMemo } from "react";
import { useSiteState } from "@/lib/project-store";

function polygonShape(points: Array<[number, number]>) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();
  return shape;
}

export function SiteEnvelopeMesh() {
  const buildableEnvelope = useSiteState((state) => state.buildableEnvelope);

  const geometry = useMemo(() => {
    if (!buildableEnvelope?.valid || buildableEnvelope.footprint.length < 3) {
      return null;
    }

    const shape = polygonShape(buildableEnvelope.footprint as Array<[number, number]>);
    return new THREE.ExtrudeGeometry(shape, {
      depth: buildableEnvelope.maxHeightMeters,
      bevelEnabled: false
    });
  }, [buildableEnvelope]);

  if (!geometry || !buildableEnvelope?.valid) {
    return null;
  }

  const bounds = buildableEnvelope.footprint.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
  const offsetX = -(bounds.minX + bounds.maxX) / 2;
  const offsetZ = -(bounds.minY + bounds.maxY) / 2;

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} position={[0, 0, 0]}>
        <meshStandardMaterial color="#4fb5c8" opacity={0.14} transparent side={THREE.DoubleSide} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#4fb5c8" opacity={0.55} transparent />
      </lineSegments>
    </group>
  );
}

export function SiteContextBuildings() {
  const { siteContext, showSiteContextLayer } = useSiteState((state) => ({
    siteContext: state.siteContext,
    showSiteContextLayer: state.showSiteContextLayer
  }));

  if (!showSiteContextLayer || !siteContext?.buildings.length) {
    return null;
  }

  const bounds = siteContext.buildings
    .flatMap((building) => building.polygon)
    .reduce(
      (acc, [x, y]) => ({
        minX: Math.min(acc.minX, x),
        minY: Math.min(acc.minY, y),
        maxX: Math.max(acc.maxX, x),
        maxY: Math.max(acc.maxY, y)
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
  const offsetX = Number.isFinite(bounds.minX) ? -(bounds.minX + bounds.maxX) / 2 : 0;
  const offsetZ = Number.isFinite(bounds.minY) ? -(bounds.minY + bounds.maxY) / 2 : 0;

  return (
    <group position={[offsetX, 0, offsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
      {siteContext.buildings.map((building) => {
        const shape = polygonShape(building.polygon as Array<[number, number]>);
        const geometry = new THREE.ExtrudeGeometry(shape, {
          depth: Math.max(3, building.heightMeters),
          bevelEnabled: false
        });

        return (
          <mesh key={building.id} geometry={geometry}>
            <meshStandardMaterial color="#64748b" opacity={0.28} transparent />
          </mesh>
        );
      })}
    </group>
  );
}
