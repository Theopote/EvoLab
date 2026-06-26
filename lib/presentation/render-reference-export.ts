import { slugifyCameraView } from "@/lib/presentation/render-capture-views";
import type { PlanVersion } from "@/lib/project-types";
import { downloadDataUrl } from "@/lib/export-utils";

export function buildRenderReferenceFileName(
  version: PlanVersion,
  cameraView: string,
  kind: "depth" | "line"
): string {
  return `${version.id}-${slugifyCameraView(cameraView)}-${kind}.png`;
}

export function downloadRenderReference(
  version: PlanVersion,
  cameraView: string,
  kind: "depth" | "line",
  dataUrl: string
) {
  downloadDataUrl(buildRenderReferenceFileName(version, cameraView, kind), dataUrl);
}
