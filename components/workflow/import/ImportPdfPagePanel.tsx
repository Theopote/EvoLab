"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchPdfImportReferencePreview } from "@/lib/import-reference-preview-client";

interface ImportPdfPagePanelProps {
  fileBase64: string;
  fileName: string;
  numPages: number;
  selectedPage: number;
  onBack: () => void;
  onContinue: (pageNumber: number) => void;
  onSelectedPageChange: (pageNumber: number) => void;
}

export function ImportPdfPagePanel({
  fileBase64,
  fileName,
  numPages,
  selectedPage,
  onBack,
  onContinue,
  onSelectedPageChange
}: ImportPdfPagePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setIsLoadingPreview(true);
      setPreviewError(undefined);

      try {
        const url = await fetchPdfImportReferencePreview(fileBase64, selectedPage);

        if (!cancelled) {
          setPreviewUrl(url);
        }
      } catch (caught) {
        if (!cancelled) {
          setPreviewUrl(undefined);
          setPreviewError(caught instanceof Error ? caught.message : "Unable to render page preview.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [fileBase64, selectedPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Select PDF page</h2>
          <p className="mt-1 text-xs text-muted">
            {fileName} · {numPages} pages. Choose the sheet to import into Plan.
          </p>
        </div>
        <button
          className="rounded border border-line px-3 py-1.5 text-xs text-muted transition hover:text-slate-100"
          type="button"
          onClick={onBack}
        >
          Back
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded border border-line bg-panel/60 p-3">
          {Array.from({ length: numPages }, (_, index) => {
            const pageNumber = index + 1;
            const isActive = pageNumber === selectedPage;

            return (
              <button
                className={`rounded border px-3 py-2 text-left text-xs transition ${
                  isActive
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-line text-slate-200 hover:border-accent/40 hover:bg-accent/5"
                }`}
                key={pageNumber}
                type="button"
                onClick={() => onSelectedPageChange(pageNumber)}
              >
                Page {pageNumber}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-[320px] place-items-center rounded border border-line bg-[#0b1118] p-4">
          {isLoadingPreview ? (
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
              <p className="mt-3 text-xs text-muted">Rendering page {selectedPage}…</p>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Preview of page ${selectedPage}`}
              className="max-h-[360px] max-w-full object-contain"
              src={previewUrl}
            />
          ) : (
            <p className="text-xs text-rose-300">{previewError ?? "Preview unavailable."}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button
          className="rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
          type="button"
          onClick={() => onContinue(selectedPage)}
        >
          Continue with page {selectedPage}
        </button>
      </div>
    </div>
  );
}
