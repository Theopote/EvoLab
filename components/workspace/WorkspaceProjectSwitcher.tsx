"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, FolderOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { getBuildingTypeLabel } from "@/lib/building-types/catalog";
import { removeProjectFromRegistry } from "@/lib/project-registry";
import type { ProjectRegistryEntry } from "@/lib/project-registry";
import { deleteRemoteProject, listLauncherProjects } from "@/lib/project-sync-client";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import { clearWorkspaceSnapshot } from "@/lib/store/workspace-persistence";
import { flushCurrentWorkspaceSnapshot } from "@/lib/workspace-snapshot-flush";

export function WorkspaceProjectSwitcher() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const project = useProjectState((state) => state.project);
  const { renameProject } = useProjectActions();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRegistryEntry[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(project.projectName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftName(project.projectName);
  }, [project.projectName]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setLoadingProjects(true);
    void listLauncherProjects(20)
      .then(setProjects)
      .finally(() => setLoadingProjects(false));
  }, [open]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditingName(false);
      }
    }

    if (open) {
      window.addEventListener("mousedown", handlePointerDown);
    }

    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  async function handleSwitchProject(projectId: string) {
    if (busy || projectId === project.projectId) {
      setOpen(false);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await flushCurrentWorkspaceSnapshot();
      setOpen(false);
      router.push(`/workspace?projectId=${encodeURIComponent(projectId)}`);
    } catch {
      setError("切换项目前保存失败，请稍后重试。");
      setBusy(false);
    }
  }

  async function handleSaveRename() {
    const trimmed = draftName.trim();

    if (!trimmed) {
      setError("项目名称不能为空。");
      return;
    }

    if (trimmed === project.projectName) {
      setEditingName(false);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      renameProject(trimmed);
      await flushCurrentWorkspaceSnapshot();
      setEditingName(false);
      setProjects((current) =>
        current.map((entry) =>
          entry.projectId === project.projectId ? { ...entry, projectName: trimmed } : entry
        )
      );
    } catch {
      setError("重命名失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProject(projectId: string, projectName: string) {
    const confirmed = window.confirm(`确定删除项目「${projectName}」？此操作不可恢复。`);

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      if (projectId === project.projectId) {
        await flushCurrentWorkspaceSnapshot();
      }

      const deleted = await deleteRemoteProject(projectId);
      if (!deleted) {
        throw new Error("delete failed");
      }

      await clearWorkspaceSnapshot(projectId);
      removeProjectFromRegistry(projectId);
      setProjects((current) => current.filter((entry) => entry.projectId !== projectId));

      if (projectId === project.projectId) {
        setOpen(false);
        router.push("/workspace");
        return;
      }
    } catch {
      setError("删除项目失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  const otherProjects = projects.filter((entry) => entry.projectId !== project.projectId);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="inline-flex max-w-56 items-center gap-1.5 truncate rounded border border-line px-2 py-1 text-sm text-slate-200 transition hover:border-accent/50 hover:text-white"
        disabled={busy}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">{project.projectName}</span>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(24rem,calc(100vw-2rem))] rounded border border-line bg-[#0b1118] p-3 shadow-2xl">
          <div className="mb-3 border-b border-line pb-3">
            <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">当前项目</div>

            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="h-8 min-w-0 flex-1 rounded border border-line bg-panel px-2 text-sm text-slate-100"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleSaveRename();
                    }

                    if (event.key === "Escape") {
                      setEditingName(false);
                      setDraftName(project.projectName);
                    }
                  }}
                />
                <button
                  className="grid h-8 w-8 place-items-center rounded border border-accent/40 text-accent"
                  disabled={busy}
                  type="button"
                  onClick={() => void handleSaveRename()}
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{project.projectName}</div>
                  <div className="mt-1 text-xs text-muted">
                    {getBuildingTypeLabel(project.projectType)} · {project.versions.length} 个方案版本
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="grid h-7 w-7 place-items-center rounded border border-line text-muted hover:border-accent/40 hover:text-accent"
                    title="重命名"
                    type="button"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="grid h-7 w-7 place-items-center rounded border border-line text-muted hover:border-warning/40 hover:text-warning"
                    title="删除项目"
                    type="button"
                    onClick={() => void handleDeleteProject(project.projectId, project.projectName)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] uppercase tracking-[0.14em] text-muted">切换项目</div>
              <Link
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                href="/workspace"
                onClick={() => setOpen(false)}
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </Link>
            </div>

            {loadingProjects ? (
              <div className="grid place-items-center py-6 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : otherProjects.length > 0 ? (
              <div className="max-h-52 space-y-1 overflow-y-auto">
                {otherProjects.map((entry) => (
                  <div className="flex items-center gap-1" key={entry.projectId}>
                    <button
                      className="min-w-0 flex-1 rounded border border-transparent px-2 py-2 text-left transition hover:border-line hover:bg-panel/80"
                      disabled={busy}
                      type="button"
                      onClick={() => void handleSwitchProject(entry.projectId)}
                    >
                      <div className="truncate text-sm text-slate-100">{entry.projectName}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {getBuildingTypeLabel(entry.projectType)} · {entry.versionCount} 版本
                      </div>
                    </button>
                    <button
                      className="grid h-8 w-8 shrink-0 place-items-center rounded border border-line text-muted hover:border-warning/40 hover:text-warning"
                      title={`删除 ${entry.projectName}`}
                      type="button"
                      onClick={() => void handleDeleteProject(entry.projectId, entry.projectName)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                没有其他项目。可新建项目或从首页示例工作流开始。
              </div>
            )}
          </div>

          {error ? <p className="text-xs text-warning">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
