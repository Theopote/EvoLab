"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { OutlineCanvas } from "@/components/plan-editor/OutlineCanvas";
import { SiteContextPanel } from "@/components/site/SiteContextPanel";
import type { Point } from "@/lib/project-types";

interface SiteWorkspaceProps {
  outline: Point[];
  outlineClosed: boolean;
  outlineStale: boolean;
  isRelayouting: boolean;
  relayoutError: string | null;
  onOutlineChange: (outline: Point[]) => void;
  onOutlineClosedChange: (closed: boolean) => void;
  onRelayout?: () => void;
}

export function SiteWorkspace({
  outline,
  outlineClosed,
  outlineStale,
  isRelayouting,
  relayoutError,
  onOutlineChange,
  onOutlineClosedChange,
  onRelayout
}: SiteWorkspaceProps) {
  return (
    <section className="grid min-h-full grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] gap-4">
      <div className="space-y-4">
        <SiteContextPanel />
        <section className="rounded border border-line bg-panel/90 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h1 className="text-base font-semibold text-white">Site Outline</h1>
              <p className="mt-1 text-xs text-muted">
                Draw the parcel boundary. Zoning and GIS context shape the buildable envelope.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {outlineStale ? (
                <button
                  className="flex h-8 items-center gap-2 rounded border border-warning/50 bg-warning/10 px-2 text-xs text-warning hover:border-warning"
                  type="button"
                  onClick={() => onRelayout?.()}
                  disabled={isRelayouting}
                >
                  {isRelayouting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                  Relayout plan
                </button>
              ) : null}
              <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">
                {outlineClosed ? "Closed" : "Open"}
              </span>
            </div>
          </div>
          {relayoutError ? (
            <div className="mb-3 rounded border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{relayoutError}</div>
          ) : null}
          <OutlineCanvas
            points={outline}
            closed={outlineClosed}
            onChange={onOutlineChange}
            onClosedChange={onOutlineClosedChange}
          />
        </section>
      </div>

      <section className="rounded border border-line bg-panel/90 p-4">
        <h2 className="text-sm font-semibold text-white">Site model</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          Site outline, zoning envelope, and surrounding context feed the domain `site` object used across massing,
          compliance, and presentation.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="Vertices" value={String(outline.length)} />
          <Metric label="State" value={outlineClosed ? "Ready for scheme" : "Drawing"} />
          <Metric label="Stale plan" value={outlineStale ? "Yes — relayout recommended" : "No"} />
        </dl>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-3 text-xs">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-slate-100">{value}</dd>
    </div>
  );
}
