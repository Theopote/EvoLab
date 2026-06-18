"use client";

import { Environment } from "@react-three/drei";

const CITY_HDRI = "/hdri/potsdamer_platz_1k.hdr";

export function SceneEnvironment() {
  return <Environment files={CITY_HDRI} />;
}
