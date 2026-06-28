"use client";

import { Loader2, MapPin, Ruler, Sparkles } from "lucide-react";
import { useSiteState, useSiteActions } from "@/lib/project-store";

export function SiteContextPanel() {
  const {
    siteAddressQuery,
    siteContext,
    isFetchingSite,
    siteError,
    zoning,
    buildableEnvelope,
    showSiteContextLayer,
    showEnvironmentOverlay
  } = useSiteState((state) => ({
    siteAddressQuery: state.siteAddressQuery,
    siteContext: state.siteContext,
    isFetchingSite: state.isFetchingSite,
    siteError: state.siteError,
    zoning: state.zoning,
    buildableEnvelope: state.buildableEnvelope,
    showSiteContextLayer: state.showSiteContextLayer,
    showEnvironmentOverlay: state.showEnvironmentOverlay
  }));
  const {
    setSiteAddressQuery,
    fetchSiteContext,
    applySuggestedSiteOutline,
    setZoning,
    setShowSiteContextLayer,
    setShowEnvironmentOverlay
  } = useSiteActions();

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Site & Context</h2>
          <p className="mt-1 text-xs text-muted">Fetch GIS context, zoning envelope, and instant environment proxies.</p>
        </div>
        <MapPin className="h-4 w-4 text-accent" />
      </div>

      <div className="space-y-3">
        <label htmlFor="site-address" className="block text-xs text-muted">
          Project address
          <input
            id="site-address"
            className="mt-1 h-9 w-full rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100"
            placeholder="e.g. 200 Renmin Avenue, Changchun"
            value={siteAddressQuery}
            onChange={(event) => setSiteAddressQuery(event.target.value)}
          />
        </label>

        <button
          className="flex h-9 w-full items-center justify-center gap-2 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:opacity-50"
          disabled={isFetchingSite || siteAddressQuery.trim().length < 3}
          type="button"
          onClick={() => fetchSiteContext()}
        >
          {isFetchingSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Fetch site context
        </button>

        {siteError ? <p className="text-xs text-warning">{siteError}</p> : null}

        {siteContext ? (
          <div className="rounded border border-line bg-[#0b1118] p-2 text-xs text-muted">
            <div className="text-slate-100">{siteContext.address.displayName}</div>
            <div className="mt-1">
              {siteContext.buildings.length} buildings · {siteContext.roads.length} roads · source {siteContext.source}
            </div>
            <button
              className="mt-2 rounded border border-line px-2 py-1 text-[11px] text-slate-200 hover:border-accent/50"
              type="button"
              onClick={applySuggestedSiteOutline}
            >
              Apply suggested site outline
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Setback (m)"
            value={zoning.setbackMeters}
            onChange={(value) => setZoning({ ...zoning, setbackMeters: value })}
          />
          <NumberField
            label="Max height (m)"
            value={zoning.maxHeightMeters}
            onChange={(value) => setZoning({ ...zoning, maxHeightMeters: value })}
          />
          <NumberField
            label="Coverage"
            value={zoning.maxCoverageRatio}
            step={0.05}
            onChange={(value) => setZoning({ ...zoning, maxCoverageRatio: value })}
          />
          <NumberField
            label="FAR"
            value={zoning.maxFar}
            step={0.1}
            onChange={(value) => setZoning({ ...zoning, maxFar: value })}
          />
        </div>

        {buildableEnvelope ? (
          <div className="rounded border border-accent/30 bg-accent/5 p-2 text-xs">
            <div className="mb-1 flex items-center gap-2 text-accent">
              <Ruler className="h-3.5 w-3.5" />
              Max buildable envelope
            </div>
            <div className="text-muted">
              Height {buildableEnvelope.maxHeightMeters}m · Floor area {buildableEnvelope.maxFloorAreaSqm} sqm · Volume{" "}
              {buildableEnvelope.volumeCubicMeters} m³
            </div>
          </div>
        ) : null}

        <label htmlFor="show-site-context" className="flex items-center gap-2 text-xs text-muted">
          <input
            id="show-site-context"
            checked={showSiteContextLayer}
            type="checkbox"
            onChange={(event) => setShowSiteContextLayer(event.target.checked)}
          />
          Show surrounding buildings & roads
        </label>
        <label htmlFor="show-environment-overlay" className="flex items-center gap-2 text-xs text-muted">
          <input
            id="show-environment-overlay"
            checked={showEnvironmentOverlay}
            type="checkbox"
            onChange={(event) => setShowEnvironmentOverlay(event.target.checked)}
          />
          Show sunlight / wind surrogate overlays
        </label>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  // Generate stable ID from label
  const id = `number-field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <label htmlFor={id} className="block text-xs text-muted">
      {label}
      <input
        id={id}
        className="mt-1 h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100"
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
