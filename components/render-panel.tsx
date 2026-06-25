"use client";

import { RenderBriefPanel } from "@/components/presentation/RenderBriefPanel";
import type { PlanVersion } from "@/lib/project-types";

interface RenderPanelProps {
  activeVersion?: PlanVersion;
}

/** @deprecated Use DeliverPresentationView / RenderBriefPanel under Presentation. */
export function RenderPanel({ activeVersion }: RenderPanelProps) {
  return <RenderBriefPanel activeVersion={activeVersion} />;
}
