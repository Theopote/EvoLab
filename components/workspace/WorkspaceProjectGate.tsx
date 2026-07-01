"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderOpen, Loader2, Plus } from "lucide-react";
import {
  BUILDING_TYPE_CATEGORIES,
  BUILDING_TYPES,
  getBuildingTypeLabel,
  type BuildingTypeDefinition
} from "@/lib/building-types/catalog";
import {
  createInitialWorkspaceSnapshot,
  createProjectBundle,
  createProjectId,
  type ProjectStartMode
} from "@/lib/projects/create-project";
import { recordProjectAccess } from "@/lib/project-registry";
import type { ProjectRegistryEntry } from "@/lib/project-registry";
import { createProjectSnapshot, listLauncherProjects } from "@/lib/project-sync-client";
import { writeWorkspaceSnapshot } from "@/lib/store/workspace-persistence";

export function WorkspaceProjectGate() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRegistryEntry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [buildingTypeId, setBuildingTypeId] = useState<BuildingTypeDefinition["id"]>("office");
  const [startMode, setStartMode] = useState<ProjectStartMode>("blank");

  useEffect(() => {
    void listLauncherProjects(20)
      .then(setProjects)
      .finally(() => setLoadingProjects(false));
  }, []);

  const selectedType = useMemo(
    () => BUILDING_TYPES.find((type) => type.id === buildingTypeId) ?? BUILDING_TYPES[0],
    [buildingTypeId]
  );

  async function handleCreateProject() {
    if (!projectName.trim()) {
      setError("请填写项目名称。");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const projectId = createProjectId();
      const bundle = createProjectBundle(
        {
          projectName: projectName.trim(),
          buildingTypeId,
          startMode
        },
        projectId
      );
      const snapshot = createInitialWorkspaceSnapshot(bundle, projectId);
      const created = await createProjectSnapshot(snapshot);

      if (!created) {
        throw new Error("无法创建项目，请稍后重试。");
      }

      await writeWorkspaceSnapshot(snapshot);
      recordProjectAccess(bundle.project);
      router.push(`/workspace?projectId=${encodeURIComponent(projectId)}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建项目失败。");
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas text-slate-100">
      <header className="border-b border-line bg-[#0b1118] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <Link className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-white" href="/">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-white">项目工作台</h1>
            <p className="mt-1 text-sm text-muted">选择正在进行的项目，或新建一个建筑方案项目。</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded border border-line bg-panel/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-white">继续已有项目</h2>
          </div>

          {loadingProjects ? (
            <div className="grid min-h-[220px] place-items-center text-sm text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : projects.length > 0 ? (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  className="flex w-full items-center justify-between rounded border border-line bg-[#0b1118] px-4 py-3 text-left transition hover:border-accent/40"
                  key={project.projectId}
                  type="button"
                  onClick={() => router.push(`/workspace?projectId=${encodeURIComponent(project.projectId)}`)}
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100">{project.projectName}</div>
                    <div className="mt-1 text-xs text-muted">
                      {getBuildingTypeLabel(project.projectType)} · {project.versionCount} 个方案版本
                    </div>
                  </div>
                  <span className="text-[11px] text-muted">
                    {new Date(project.lastAccessedAt).toLocaleDateString("zh-CN")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
              还没有进行中的项目。请在右侧新建一个项目开始设计。
            </div>
          )}
        </section>

        <section className="rounded border border-line bg-panel/80 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-white">新建项目</h2>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1 text-xs text-muted">
              项目名称
              <input
                className="h-10 rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100"
                placeholder="例如：滨江办公总部"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </label>

            <div className="grid gap-2">
              <span className="text-xs text-muted">建筑类型</span>
              <div className="max-h-56 space-y-3 overflow-y-auto rounded border border-line bg-[#0b1118] p-3">
                {BUILDING_TYPE_CATEGORIES.map((category) => {
                  const types = BUILDING_TYPES.filter((type) => type.category === category.id);
                  if (!types.length) {
                    return null;
                  }

                  return (
                    <div key={category.id}>
                      <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">{category.labelZh}</div>
                      <div className="flex flex-wrap gap-2">
                        {types.map((type) => (
                          <button
                            className={`rounded border px-2.5 py-1.5 text-xs transition ${
                              buildingTypeId === type.id
                                ? "border-accent/50 bg-accent/15 text-accent"
                                : "border-line text-slate-300 hover:border-accent/30"
                            }`}
                            key={type.id}
                            type="button"
                            onClick={() => setBuildingTypeId(type.id)}
                          >
                            {type.labelZh}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs leading-5 text-muted">{selectedType.description}</p>
            </div>

            <div className="grid gap-2">
              <span className="text-xs text-muted">启动方式</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  className={`rounded border px-3 py-3 text-left text-xs transition ${
                    startMode === "blank"
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line text-muted hover:border-accent/30"
                  }`}
                  type="button"
                  onClick={() => setStartMode("blank")}
                >
                  <div className="font-medium text-slate-100">空白项目</div>
                  <div className="mt-1 leading-5">从资料导入开始，逐步建立场地与方案。</div>
                </button>
                <button
                  className={`rounded border px-3 py-3 text-left text-xs transition ${
                    startMode === "demo"
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-line text-muted hover:border-accent/30"
                  }`}
                  type="button"
                  onClick={() => setStartMode("demo")}
                >
                  <div className="font-medium text-slate-100">带示例方案</div>
                  <div className="mt-1 leading-5">预置 typology 示例与评分基线，便于快速体验。</div>
                </button>
              </div>
            </div>

            {error ? <p className="text-xs text-warning">{error}</p> : null}

            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded border border-accent/50 bg-accent/15 px-4 text-sm font-medium text-accent transition hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={creating}
              type="button"
              onClick={() => void handleCreateProject()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              创建并进入工作台
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
