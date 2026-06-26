import type { DesignBrief, PlanVersion } from "@/lib/project-types";

export interface RenderPromptOptions {
  materialStyle: string;
  lighting: string;
  cameraView: string;
  purpose: string;
  notes: string;
  projectType?: string;
  brief?: DesignBrief;
}

export interface StructuredRenderPrompt {
  positive_prompt: string;
  negative_prompt: string;
  brief: string;
  metadata: {
    versionLabel: string;
    projectType?: string;
    floorCount: number;
    totalAreaSqm: number;
    footprint: { widthM: number; depthM: number };
    roomCount: number;
    materialStyle: string;
    lighting: string;
    cameraView: string;
    purpose: string;
  };
  controlnet: {
    recommended: "depth" | "canny";
    referenceHint: string;
  };
}

const DEFAULT_NEGATIVE_PROMPT =
  "blurry, distorted geometry, warped perspective, cartoon, low quality, watermark, text overlay, people, cars, clutter, oversaturated";

function summarizeRooms(version: PlanVersion): string {
  const byZone = new Map<string, string[]>();

  for (const room of version.rooms) {
    const bucket = byZone.get(room.zone) ?? [];
    bucket.push(`${room.name} (${room.type}, ${room.areaSqm} sqm)`);
    byZone.set(room.zone, bucket);
  }

  return [...byZone.entries()]
    .map(([zone, rooms]) => `${zone}: ${rooms.join("; ")}`)
    .join(" | ");
}

function describeTopology(version: PlanVersion): string | undefined {
  const topology = version.metadata?.topology;
  if (!topology) {
    return undefined;
  }

  return [
    topology.circulation ? `circulation ${topology.circulation}` : null,
    topology.core ? `core ${topology.core}` : null,
    topology.daylight ? `daylight ${topology.daylight}` : null
  ]
    .filter(Boolean)
    .join(", ");
}

function describeLevels(version: PlanVersion): string {
  const levels = version.levels.length > 0 ? version.levels : version.building.levels;
  if (levels.length === 0) {
    return "single level";
  }

  return levels.map((level) => `${level.name} (+${level.elevation}m, ${level.height}m)`).join("; ");
}

export function buildRenderBrief(version: PlanVersion, options: RenderPromptOptions): string {
  const totalAreaSqm = version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
  const topology = describeTopology(version);
  const levelSummary = describeLevels(version);
  const roomSummary = summarizeRooms(version);
  const projectLabel = options.projectType ?? options.brief?.projectType;

  return [
    `Project: ${version.label}`,
    projectLabel ? `Typology: ${projectLabel}.` : null,
    `Source: editable EvoLab PlanVersion with ${version.rooms.length} rooms across ${version.levels.length || version.building.levels.length || 1} level(s).`,
    `Footprint: ${version.overallBounds.width.toFixed(1)}m x ${version.overallBounds.height.toFixed(1)}m; total programmed area ${totalAreaSqm.toFixed(0)} sqm.`,
    `Levels: ${levelSummary}.`,
    topology ? `Topology: ${topology}.` : null,
    `Material style: ${options.materialStyle}.`,
    `Lighting: ${options.lighting}.`,
    `Camera: ${options.cameraView}.`,
    `Purpose: ${options.purpose}.`,
    `Rooms: ${roomSummary}.`,
    `Notes: ${options.notes}`
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStructuredRenderPrompt(
  version: PlanVersion,
  options: RenderPromptOptions
): StructuredRenderPrompt {
  const totalAreaSqm = version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
  const floorCount = version.levels.length || version.building.levels.length || 1;
  const topology = describeTopology(version);
  const brief = buildRenderBrief(version, options);

  const positiveParts = [
    "professional architectural visualization",
    options.materialStyle.toLowerCase(),
    options.lighting.toLowerCase(),
    options.cameraView.toLowerCase(),
    `${floorCount}-floor ${options.projectType ?? options.brief?.projectType ?? "building"} massing`,
    `${version.overallBounds.width.toFixed(0)}m by ${version.overallBounds.height.toFixed(0)}m footprint`,
    topology,
    options.notes
  ].filter(Boolean);

  return {
    positive_prompt: positiveParts.join(", "),
    negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    brief,
    metadata: {
      versionLabel: version.label,
      projectType: options.projectType ?? options.brief?.projectType,
      floorCount,
      totalAreaSqm: Math.round(totalAreaSqm),
      footprint: {
        widthM: version.overallBounds.width,
        depthM: version.overallBounds.height
      },
      roomCount: version.rooms.length,
      materialStyle: options.materialStyle,
      lighting: options.lighting,
      cameraView: options.cameraView,
      purpose: options.purpose
    },
    controlnet: {
      recommended: "depth",
      referenceHint:
        "Export a depth or line-art pass from the EvoLab 3D preview or presentation capture, then pair with this prompt in Stable Diffusion ControlNet."
    }
  };
}
