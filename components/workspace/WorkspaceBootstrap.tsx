"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { recordProjectAccess } from "@/lib/project-registry";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import type { TypologyPackId } from "@/lib/typology/types";

const templateIds = new Set<TypologyPackId>(["healthcare", "office", "residential", "school"]);

export function WorkspaceBootstrap() {
  const searchParams = useSearchParams();
  const project = useProjectState((state) => state.project);
  const { loadDemoProject, setWorkflowPhase, setActiveTab } = useProjectActions();

  useEffect(() => {
    recordProjectAccess(project);
  }, [project.projectId, project.projectName, project.projectType, project.versions.length]);

  useEffect(() => {
    const template = searchParams.get("template");
    if (template && templateIds.has(template as TypologyPackId)) {
      loadDemoProject(template as TypologyPackId);
      return;
    }

    if (searchParams.get("phase") === "import") {
      setWorkflowPhase("import");
      setActiveTab("Import");
    }
  }, [loadDemoProject, searchParams, setActiveTab, setWorkflowPhase]);

  return null;
}
