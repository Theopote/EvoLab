"use client";

import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH } from "three";

/**
 * CAD/BIM-style navigation: right-drag pan, scroll zoom, left-drag orbit.
 * OrbitControls matches 建筑软件习惯 better than MapControls (which pans on left).
 */
export function CadViewControls() {
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={220}
      target={[0, 0, 0]}
      mouseButtons={{
        LEFT: MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: MOUSE.PAN
      }}
      touches={{
        ONE: TOUCH.ROTATE,
        TWO: TOUCH.DOLLY_PAN
      }}
    />
  );
}
