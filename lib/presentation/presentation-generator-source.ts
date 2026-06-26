import { normalizeProjectVersions } from "@/lib/architecture-model";
import { normalizeProjectData } from "@/lib/project-domain";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import { createDemoProjectData } from "@/lib/typologies";
import type { TypologyPackId } from "@/lib/typology/types";
import { getPlanVersionOutput } from "@/lib/tools/tool-session-utils";
import type { ToolSessionDetail } from "@/lib/tools/tool-session-types";

export type PresentationGeneratorSourceKind = "project" | "demo" | "tool-session";

export interface PresentationGeneratorSource {
  kind: PresentationGeneratorSourceKind;
  label: string;
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  compareVersionIds?: string[];
  sourceSessionId?: string;
}

export function createPresentationProjectFromVersion(input: {
  projectName: string;
  projectType?: string;
  version: PlanVersion;
  versions?: PlanVersion[];
}): ProjectData {
  const versions = input.versions ?? [input.version];

  return normalizeProjectData({
    projectId: `presentation-${input.version.id}`,
    projectName: input.projectName,
    projectType: input.projectType ?? "mixed-use",
    activeVersionId: input.version.id,
    versions: normalizeProjectVersions(versions)
  });
}

export function presentationSourceFromDemo(typologyId: TypologyPackId): PresentationGeneratorSource {
  const project = createDemoProjectData(typologyId);
  const version = project.versions.find((item) => item.id === project.activeVersionId) ?? project.versions[0]!;

  return {
    kind: "demo",
    label: `${project.projectName}`,
    project,
    version,
    compareVersionIds: project.versions.slice(0, 2).map((item) => item.id)
  };
}

export function presentationSourceFromProject(input: {
  project: ProjectData;
  version: PlanVersion;
  brief?: DesignBrief;
  compareVersionIds?: string[];
}): PresentationGeneratorSource {
  return {
    kind: "project",
    label: input.version.label,
    project: input.project,
    version: input.version,
    brief: input.brief,
    compareVersionIds: input.compareVersionIds
  };
}

export function presentationSourceFromToolSession(session: ToolSessionDetail): PresentationGeneratorSource | undefined {
  const planOutput = getPlanVersionOutput(session);
  if (!planOutput) {
    return undefined;
  }

  const version = planOutput.planVersion;
  const projectName = session.title.replace(/ · .+$/, "") || session.title;

  return {
    kind: "tool-session",
    label: session.title,
    project: createPresentationProjectFromVersion({
      projectName,
      projectType: session.toolId === "retained-structure-remix" ? "retrofit" : "import",
      version,
      versions: planOutput.sourcePlanVersion ? [planOutput.sourcePlanVersion, version] : [version]
    }),
    version,
    compareVersionIds: planOutput.sourcePlanVersion ? [planOutput.sourcePlanVersion.id, version.id] : undefined,
    sourceSessionId: session.id
  };
}

export function defaultStoryArcFromDeck(slides: { kind: string; title: string }[]): string[] {
  const labels: Record<string, string> = {
    cover: "项目概述",
    site: "场地与背景",
    evolution: "方案演进",
    topology: "空间拓扑",
    massing: "体量研究",
    plan: "平面方案",
    zones: "功能分区",
    flow: "流线组织",
    facade: "立面策略",
    systems: "机电系统",
    compare: "方案比选",
    analysis: "性能分析",
    quantities: "面积指标",
    cost: "造价估算",
    narrative: "设计叙事"
  };

  return slides.map((slide) => labels[slide.kind] ?? slide.title);
}
