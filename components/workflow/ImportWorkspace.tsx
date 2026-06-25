"use client";

import { FileUp, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { readCopilotUpload, type CopilotPinnedFile } from "@/lib/copilot-upload";
import { useCopilotUploadStore } from "@/lib/copilot-upload-store";
import { analyzePlanFromUpload } from "@/lib/plan-import-client";
import type { PlanVersion } from "@/lib/project-types";

export interface ImportWorkspaceResult {
  version: PlanVersion;
  fileName: string;
  warnings?: string[];
  confidence?: number;
  importPath?: "vision" | "structured";
  sourceType?: string;
}

interface ImportWorkspaceProps {
  onImported: (result: ImportWorkspaceResult) => void;
}

const supportedFormats = ["PNG", "JPEG", "GIF", "WebP", "PDF", "DXF"];

export function ImportWorkspace({ onImported }: ImportWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestId = useCopilotUploadStore((state) => state.uploadRequestId);
  const [pinnedFile, setPinnedFile] = useState<CopilotPinnedFile | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (uploadRequestId > 0) {
      fileInputRef.current?.click();
    }
  }, [uploadRequestId]);

  async function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setNotice(null);

    try {
      const parsed = await readCopilotUpload(file);
      setPinnedFile(parsed);
      setNotice(`Ready to import ${parsed.fileName}.`);
    } catch (readError) {
      setPinnedFile(null);
      setError(readError instanceof Error ? readError.message : "Failed to read file.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function runImport() {
    if (!pinnedFile || isImporting) {
      return;
    }

    setIsImporting(true);
    setError(null);
    setNotice(null);

    try {
      const result = await analyzePlanFromUpload({
        fileBase64: pinnedFile.base64,
        fileName: pinnedFile.fileName,
        sourceType: pinnedFile.sourceType
      });

      onImported({
        version: result.version,
        fileName: result.fileName,
        warnings: result.warnings,
        confidence: result.confidence,
        importPath: result.importPath,
        sourceType: result.sourceType
      });

      setPinnedFile(null);
      setNotice(`Imported ${result.version.label} from ${pinnedFile.fileName}.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <section className="grid min-h-[520px] grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] gap-4">
      <div
        className="flex min-h-[480px] flex-col items-center justify-center rounded border border-dashed border-line bg-panel/60 p-8 text-center"
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="mb-4 h-10 w-10 text-accent" />
        <h2 className="text-base font-semibold text-white">Import drawings</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted">
          Drop a CAD or raster drawing here, or browse files. Supported formats: {supportedFormats.join(", ")}.
        </p>
        <button
          className="mt-6 flex h-9 items-center gap-2 rounded border border-accent/50 bg-accent/10 px-4 text-sm text-accent hover:border-accent"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          Choose file
        </button>
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,.pdf,.dxf,application/pdf"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      <aside className="flex min-h-0 flex-col rounded border border-line bg-panel/90 p-4">
        <h3 className="text-sm font-semibold text-white">Import queue</h3>
        <p className="mt-1 text-xs text-muted">Recognized geometry becomes a new version on the project timeline.</p>

        {pinnedFile ? (
          <div className="mt-4 rounded border border-line bg-[#0b1118] p-3">
            <div className="flex items-start gap-3">
              <img alt="" className="h-14 w-14 rounded border border-line object-cover" src={pinnedFile.previewUrl} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{pinnedFile.fileName}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-muted">{pinnedFile.sourceType}</div>
              </div>
            </div>
            <button
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded border border-accent/50 bg-accent/10 text-sm text-accent hover:border-accent disabled:opacity-60"
              disabled={isImporting}
              type="button"
              onClick={() => void runImport()}
            >
              {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isImporting ? "Recognizing plan…" : "Run import"}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded border border-dashed border-line p-4 text-xs leading-5 text-muted">
            No file selected. Upload from the drop zone or use Upload in Quick Tools.
          </div>
        )}

        {notice ? <p className="mt-3 text-xs text-success">{notice}</p> : null}
        {error ? <p className="mt-3 text-xs text-warning">{error}</p> : null}
      </aside>
    </section>
  );
}
