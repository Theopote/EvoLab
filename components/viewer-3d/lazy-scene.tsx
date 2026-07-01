"use client";

import dynamic from "next/dynamic";

function SceneLoadingFallback() {
  return (
    <div className="grid h-full min-h-[380px] place-items-center rounded border border-dashed border-line bg-[#081018] text-sm text-muted">
      加载 3D 场景…
    </div>
  );
}

export const LazyScene = dynamic(
  () => import("@/components/viewer-3d/Scene").then((module) => ({ default: module.Scene })),
  { ssr: false, loading: SceneLoadingFallback }
);
