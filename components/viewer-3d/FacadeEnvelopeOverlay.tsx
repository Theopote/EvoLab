"use client";

import * as THREE from "three";
import { useMemo } from "react";
import type { FacadeEnvelope } from "@/lib/building-domain";
import type { Point, Room } from "@/lib/project-types";
import {
  buildFacadeSegmentOverlays,
  facadeStrategyMaterial,
  windowSlotsAlongSegment,
  type FacadeSegmentOverlay
} from "@/lib/viewer-3d/facade-envelope";

function createRoomShape(polygon: Point[]) {
  const shape = new THREE.Shape();
  polygon.forEach(([x, y], index) => {
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  shape.closePath();
  return shape;
}

interface FacadeEnvelopeOverlayProps {
  outline: Point[];
  levelId: string;
  levelHeight: number;
  facade: FacadeEnvelope;
  orientationDeg?: number;
}

export function FacadeEnvelopeOverlay({
  outline,
  levelId,
  levelHeight,
  facade,
  orientationDeg = 0
}: FacadeEnvelopeOverlayProps) {
  const segments = useMemo(
    () =>
      buildFacadeSegmentOverlays({
        outline,
        levelId,
        facade,
        orientationDeg
      }),
    [outline, levelId, facade, orientationDeg]
  );

  if (!segments.length) {
    return null;
  }

  return (
    <>
      {segments.map((segment) => (
        <FacadeSegmentMesh key={segment.id} levelHeight={levelHeight} segment={segment} />
      ))}
    </>
  );
}

function FacadeSegmentMesh({
  segment,
  levelHeight
}: {
  segment: FacadeSegmentOverlay;
  levelHeight: number;
}) {
  const dx = segment.end[0] - segment.start[0];
  const dy = segment.end[1] - segment.start[1];
  const length = Math.max(0.01, segment.length);
  const angle = Math.atan2(dy, dx);
  const midX = (segment.start[0] + segment.end[0]) / 2;
  const midY = (segment.start[1] + segment.end[1]) / 2;
  const material = facadeStrategyMaterial(segment.strategy);
  const showWindows = segment.strategy === "punched_window" || segment.strategy === "mixed" || segment.strategy === "curtain_wall";
  const windowSlots = showWindows ? windowSlotsAlongSegment(length, segment.windowRatio) : [];

  return (
    <group>
      <mesh position={[midX, levelHeight / 2, -midY]} rotation={[0, 0, angle]}>
        <boxGeometry args={[length, levelHeight, 0.12]} />
        <meshStandardMaterial
          color={material.color}
          emissive={material.emissive}
          emissiveIntensity={material.emissiveIntensity}
          opacity={material.opacity}
          transparent
        />
      </mesh>

      {windowSlots.map((slot, index) => {
        const sill = segment.strategy === "curtain_wall" ? 0.15 : 0.9;
        const openingHeight = segment.strategy === "curtain_wall" ? levelHeight * 0.82 : Math.min(1.5, levelHeight * 0.42);
        const px = segment.start[0] + Math.cos(angle) * slot.centerOffset;
        const py = segment.start[1] + Math.sin(angle) * slot.centerOffset;

        return (
          <mesh
            key={`${segment.id}-window-${index}`}
            position={[px, sill + openingHeight / 2, -py]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[slot.width, openingHeight, 0.16]} />
            <meshStandardMaterial
              color={segment.strategy === "curtain_wall" ? "#bae6fd" : "#dcfce7"}
              emissive={segment.strategy === "curtain_wall" ? "#0284c7" : "#15803d"}
              emissiveIntensity={0.45}
              opacity={0.88}
              transparent
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function FacadeOutlinePreview({ outline }: { outline: Point[] }) {
  const shape = useMemo(() => createRoomShape(outline), [outline]);

  return (
    <mesh position={[0, 0, 0.02]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color="#5eead4" opacity={0.08} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}
