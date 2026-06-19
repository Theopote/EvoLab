"use client";

import { useRef, useState } from "react";
import { FileImage, FileSpreadsheet, FileType2, Loader2, Upload, Wand2 } from "lucide-react";
import { ImportPreviewPanel } from "@/components/workflow/import/ImportPreviewPanel";
import { readCopilotUpload, type CopilotPinnedFile } from "@/lib/copilot-upload";
import { analyzePlanDrawing } from "@/lib/plan-import/analyze-plan-client";
import type { AnalyzePlanClientResult } from "@/lib/plan-import/analyze-plan-client";
import type { PlanImportSource } from "@/lib/plan-import/types";
import type { PlanVersion } from "@/lib/project-types";

type ImportWizardStep = "home" | "upload" | "analyzing" | "review";
type ImportKind = PlanImportSource;

const importKinds: Array<{
  id: ImportKind;
  title: string;
  description: string;
  icon: typeof FileImage;
  accept: string;
  pipeline: string;
}> = [
  {
    id: "image",
    title: "Image / scan",
    description: "Photos, scans, or raster exports. Vision recognition with optional trace correction.",
    icon: FileImage,
    accept: ".png,.jpg,.jpeg,.gif,.webp,image/*",
    pipeline: "Upload → recognize → trace refine"
  },
  {
    id: "pdf",
    title: "PDF drawing",
    description: "Vector or text-based PDFs. Structured extraction with vision fallback.",
    icon: FileType2,
    accept: ".pdf,application/pdf",
    pipeline: "Text/vector extract → contour rebuild"
  },
  {
    id: "dxf",
    title: "DXF / CAD",
    description: "Layer-aware wall and room label parsing for editable semantic geometry.",
    icon: FileSpreadsheet,
    accept: ".dxf",
    pipeline: "Wall layers → room rebuild"
  }
];

export interface ImportWizardResult {
  version: PlanVersion;
  analysis: AnalyzePlanClientResult;
  file: CopilotPinnedFile;
  openTrace: boolean;
}

interface ImportWizardProps {
  onImportComplete: (result: ImportWizardResult) => void;
  onContinueToTrace: () => void;
}

export function ImportWizard({ onImportComplete, onContinueToTrace }: ImportWizardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportWizardStep>("home");
  const [selectedKind, setSelectedKind] = useState<ImportKind>("image");
  const [pinnedFile, setPinnedFile] = useState<CopilotPinnedFile | undefined>();
  const [analysis, setAnalysis] = useState<AnalyzePlanClientResult | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isDragging, setIsDragging] = useState(false);

  const selectedKindConfig = importKinds.find((kind) => kind.id === selectedKind) ?? importKinds[0];

  async function processFile(file: File) {
    setError(undefined);
    setStep("analyzing");

    try {
      const pinned = await readCopilotUpload(file);
      setPinnedFile(pinned);

      const result = await analyzePlanDrawing({
        fileBase64: pinned.base64,
        fileName: pinned.fileName,
        sourceType: pinned.sourceType
      });

      setAnalysis(result);
      setStep("review");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
      setStep("upload");
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resetWizard() {
    setStep("home");
    setPinnedFile(undefined);
    setAnalysis(undefined);
    setError(undefined);
  }

  function confirmImport(openTrace: boolean) {
    if (!pinnedFile || !analysis) {
      return;
    }

    onImportComplete({
      version: analysis.version,
      analysis,
      file: pinnedFile,
      openTrace
    });

    resetWizard();
  }

  return (
    <section className="flex min-h-full flex-col">
      <header className="mb-4">
        <h1 className="text-lg font-semibold text-white">Import & Trace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Bring existing drawings into EvoLab as editable scheme versions. Choose a source type, review recognition
          results, then refine boundaries in trace mode.
        </p>
        <WizardSteps step={step} />
      </header>

      <input
        ref={fileInputRef}
        accept={selectedKindConfig.accept}
        className="hidden"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            void processFile(file);
          }

          event.currentTarget.value = "";
        }}
      />

      {step === "home" ? (
        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_280px]">
          <div className="grid gap-3 sm:grid-cols-3">
            {importKinds.map((kind) => (
              <ImportKindCard
                active={selectedKind === kind.id}
                description={kind.description}
                icon={kind.icon}
                key={kind.id}
                pipeline={kind.pipeline}
                title={kind.title}
                onSelect={() => {
                  setSelectedKind(kind.id);
                  setStep("upload");
                }}
              />
            ))}
          </div>

          <aside className="rounded border border-line bg-panel/90 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wand2 className="h-4 w-4 text-accent" />
              Trace only
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              Already have a scheme version? Jump to Scheme and trace room polygons over the plan canvas.
            </p>
            <button
              className="mt-4 w-full rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5"
              type="button"
              onClick={onContinueToTrace}
            >
              Open trace mode
            </button>
          </aside>
        </div>
      ) : null}

      {step === "upload" ? (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{selectedKindConfig.title}</h2>
              <p className="mt-1 text-xs text-muted">{selectedKindConfig.pipeline}</p>
            </div>
            <button
              className="rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:text-slate-100"
              type="button"
              onClick={() => setStep("home")}
            >
              Back
            </button>
          </div>

          <button
            className={`grid min-h-[280px] flex-1 place-items-center rounded border border-dashed p-8 text-center transition ${
              isDragging ? "border-accent bg-accent/10" : "border-line bg-panel/60 hover:border-accent/40 hover:bg-accent/5"
            }`}
            type="button"
            onClick={openFilePicker}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files?.[0];

              if (file) {
                void processFile(file);
              }
            }}
          >
            <div>
              <Upload className="mx-auto h-8 w-8 text-accent" />
              <p className="mt-4 text-sm font-medium text-white">Drop a file or click to upload</p>
              <p className="mt-2 text-xs text-muted">
                {selectedKind === "image"
                  ? "PNG, JPEG, GIF, WebP"
                  : selectedKind === "pdf"
                    ? "PDF drawings with vector or text layers"
                    : "DXF exports (DWG must be exported first)"}
              </p>
            </div>
          </button>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      ) : null}

      {step === "analyzing" ? (
        <div className="grid flex-1 place-items-center rounded border border-line bg-panel/60 p-10 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="mt-4 text-sm font-medium text-white">Recognizing {pinnedFile?.fileName ?? "drawing"}…</p>
          <p className="mt-2 max-w-md text-xs leading-5 text-muted">
            {selectedKind === "image"
              ? "Running vision extraction for walls, openings, and room labels."
              : selectedKind === "pdf"
                ? "Parsing PDF text and vector operators. Sparse results will trigger a vision fallback."
                : "Parsing DXF wall layers, blocks, and room annotations."}
          </p>
        </div>
      ) : null}

      {step === "review" && analysis && pinnedFile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <ImportPreviewPanel
            confidence={analysis.confidence}
            fallback={analysis.fallback}
            fileName={pinnedFile.fileName}
            importPath={analysis.importPath}
            sourceType={analysis.sourceType}
            version={analysis.version}
            warnings={analysis.warnings}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <button
              className="rounded border border-line px-3 py-2 text-xs text-muted transition hover:text-slate-100"
              type="button"
              onClick={() => {
                setAnalysis(undefined);
                setStep("upload");
              }}
            >
              Upload another file
            </button>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded border border-line px-3 py-2 text-xs text-slate-100 transition hover:border-accent/50 hover:bg-accent/5"
                type="button"
                onClick={() => confirmImport(false)}
              >
                Create scheme version
              </button>
              <button
                className="rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
                type="button"
                onClick={() => confirmImport(true)}
              >
                Create & open trace
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function WizardSteps({ step }: { step: ImportWizardStep }) {
  const steps = [
    { id: "home", label: "Choose source" },
    { id: "upload", label: "Upload" },
    { id: "analyzing", label: "Recognize" },
    { id: "review", label: "Review" }
  ] as const;

  const activeIndex = steps.findIndex((entry) => entry.id === step);

  return (
    <ol className="mt-4 flex flex-wrap gap-2">
      {steps.map((entry, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <li
            className={`rounded border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${
              isActive
                ? "border-accent/50 bg-accent/10 text-accent"
                : isComplete
                  ? "border-line text-slate-200"
                  : "border-line/70 text-muted"
            }`}
            key={entry.id}
          >
            {entry.label}
          </li>
        );
      })}
    </ol>
  );
}

function ImportKindCard({
  active,
  title,
  description,
  pipeline,
  icon: Icon,
  onSelect
}: {
  active: boolean;
  title: string;
  description: string;
  pipeline: string;
  icon: typeof FileImage;
  onSelect: () => void;
}) {
  return (
    <button
      className={`rounded border p-4 text-left transition ${
        active ? "border-accent/50 bg-accent/10" : "border-line bg-[#0b1118] hover:border-accent/40 hover:bg-accent/5"
      }`}
      type="button"
      onClick={onSelect}
    >
      <Icon className="h-5 w-5 text-accent" />
      <div className="mt-3 text-sm font-medium text-white">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-accent/80">{pipeline}</p>
    </button>
  );
}
