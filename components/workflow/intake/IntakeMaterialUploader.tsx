"use client";

import { useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { readIntakeMaterial } from "@/lib/intake/intake-material-reader";
import type { IntakeMaterialInput } from "@/lib/intake/mock-intake-synthesis";
import type { IntakeSourceFile } from "@/lib/intake/project-intake-types";
import { synthesizeIntakeClient } from "@/lib/intake/synthesize-intake-client";
import { useProjectActions, useProjectState } from "@/lib/project-store";

interface PendingMaterial {
  metadata: IntakeSourceFile;
  material: IntakeMaterialInput;
}

export function IntakeMaterialUploader({
  onSynthesized
}: {
  onSynthesized?: (fallback: boolean) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectName = useProjectState((state) => state.project.projectName);
  const intake = useProjectState((state) => state.project.domain.intake);
  const { updateProjectIntake } = useProjectActions();
  const [pendingMaterials, setPendingMaterials] = useState<PendingMaterial[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sourceFiles = intake?.sourceFiles ?? [];

  async function handleFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    setIsUploading(true);
    setError(undefined);

    try {
      const nextItems: PendingMaterial[] = [];

      for (const file of Array.from(files)) {
        nextItems.push(await readIntakeMaterial(file));
      }

      setPendingMaterials((current) => [...current, ...nextItems]);
      updateProjectIntake({
        sourceFiles: [...sourceFiles, ...nextItems.map((item) => item.metadata)]
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSynthesize() {
    if (!pendingMaterials.length) {
      setError("请先上传至少一份资料。");
      return;
    }

    setIsSynthesizing(true);
    setError(undefined);

    try {
      const result = await synthesizeIntakeClient({
        projectName,
        materials: pendingMaterials.map((item) => item.material)
      });

      updateProjectIntake({
        summary: result.summary,
        constraints: result.constraints,
        risks: result.risks,
        opportunities: result.opportunities,
        openQuestions: result.openQuestions,
        lastSynthesizedAt: new Date().toISOString()
      });
      onSynthesized?.(Boolean(result.fallback));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Synthesis failed.");
    } finally {
      setIsSynthesizing(false);
    }
  }

  function removeFile(id: string) {
    setPendingMaterials((current) => current.filter((item) => item.metadata.id !== id));
    updateProjectIntake({
      sourceFiles: sourceFiles.filter((item) => item.id !== id)
    });
  }

  return (
    <section className="rounded border border-line bg-[#0b1118] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">资料上传</h3>
          <p className="mt-1 text-xs text-muted">支持 TXT / MD / PDF / 图片，用于 AI 摘要与风险提炼。</p>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 disabled:opacity-40"
          disabled={isSynthesizing || pendingMaterials.length === 0}
          type="button"
          onClick={() => void handleSynthesize()}
        >
          {isSynthesizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          AI 提炼资料
        </button>
      </div>

      <input
        ref={fileInputRef}
        accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf,text/*"
        className="hidden"
        multiple
        type="file"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <button
        className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-line px-4 py-6 text-sm text-muted transition hover:border-accent/40 hover:text-accent disabled:opacity-50"
        disabled={isUploading}
        type="button"
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        上传资料文件
      </button>

      {sourceFiles.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {sourceFiles.map((file) => (
            <li className="flex items-start justify-between gap-2 rounded border border-line bg-panel/70 px-3 py-2 text-xs" key={file.id}>
              <div className="min-w-0">
                <div className="truncate text-slate-100">{file.fileName}</div>
                <div className="mt-1 text-muted">{file.kind.toUpperCase()} · {file.excerpt ?? "已上传"}</div>
              </div>
              <button
                className="shrink-0 rounded border border-line p-1 text-muted hover:border-danger/50 hover:text-danger"
                type="button"
                aria-label="删除资料"
                onClick={() => removeFile(file.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {intake?.lastSynthesizedAt ? (
        <p className="mt-3 text-[11px] text-muted">
          上次 AI 提炼：{new Date(intake.lastSynthesizedAt).toLocaleString("zh-CN")}
        </p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </section>
  );
}
