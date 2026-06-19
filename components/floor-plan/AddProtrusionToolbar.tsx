"use client";

import { Eraser, SquarePlus } from "lucide-react";
import { useState } from "react";
import type { PlanVersion } from "@/lib/project-types";
import { DiffPreviewOverlay } from "@/components/floor-plan/DiffPreviewOverlay";
import { protrusionDimensions } from "@/lib/add-protrusion";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { useEvoProject } from "@/lib/project-store";

interface AddProtrusionToolbarProps {
  version?: PlanVersion;
  levelId?: string;
  onApplyRevision: (version: PlanVersion, prompt: string) => void;
}

export function AddProtrusionToolbar({ version, levelId, onApplyRevision }: AddProtrusionToolbarProps) {
  const scoringConfig = useEvoProject((state) => state.project.domain.scoringConfig);
  const protrusionPlacement = useLocalFormEditStore((state) => state.protrusionPlacement);
  const protrusionPrompt = useLocalFormEditStore((state) => state.protrusionPrompt);
  const protrusionWidthM = useLocalFormEditStore((state) => state.protrusionWidthM);
  const setProtrusionPrompt = useLocalFormEditStore((state) => state.setProtrusionPrompt);
  const setProtrusionPlacement = useLocalFormEditStore((state) => state.setProtrusionPlacement);
  const setProtrusionWidthM = useLocalFormEditStore((state) => state.setProtrusionWidthM);
  const clearProtrusionPlacement = useLocalFormEditStore((state) => state.clearProtrusionPlacement);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{
    version: PlanVersion;
    prompt: string;
    warning?: string;
    gfaBasis?: string;
    dimensionOverlay?: { widthM: number; depthM: number; label: string };
  } | null>(null);

  const level = version?.levels.find((item) => item.id === levelId) ?? version?.levels[0];
  const walls = level?.walls ?? [];
  const selectedWall = protrusionPlacement ? walls.find((wall) => wall.id === protrusionPlacement.wallId) : undefined;
  const hostRoomId = selectedWall?.roomIds.find((roomId) => {
    const room = version?.rooms.find((item) => item.id === roomId);
    return room && room.type !== "corridor";
  });

  async function submitProtrusion() {
    if (!version || !selectedWall || !hostRoomId || !protrusionPrompt.trim() || isSending) {
      return;
    }

    setIsSending(true);
    setNotice(null);

    try {
      const response = await fetch("/api/add-protrusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentVersion: version,
          roomId: hostRoomId,
          wall: selectedWall,
          positionOnEdge: protrusionPlacement?.positionOnEdge ?? 0.5,
          widthM: protrusionWidthM,
          userRequest: protrusionPrompt.trim(),
          levelId,
          scoringConfig
        })
      });

      const data = (await response.json()) as {
        version?: PlanVersion;
        protrusion?: { depthM: number; widthM?: number };
        warning?: string;
        gfaBasis?: string;
        error?: string;
      };

      if (!response.ok || !data.version || !data.protrusion) {
        throw new Error(data.error ?? `add-protrusion failed with ${response.status}`);
      }

      const dimensions = protrusionDimensions({
        id: "preview",
        type: "bay_window",
        footprint: [],
        depthM: data.protrusion.depthM,
        widthM: data.protrusion.widthM ?? protrusionWidthM
      });

      setPendingPreview({
        version: data.version,
        prompt: protrusionPrompt.trim(),
        warning: data.warning,
        gfaBasis: data.gfaBasis,
        dimensionOverlay: {
          widthM: dimensions.widthM,
          depthM: dimensions.depthM,
          label: `${dimensions.widthM.toFixed(2)}m × ${dimensions.depthM.toFixed(2)}m`
        }
      });
      setNotice("Review the protrusion union before accepting.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Protrusion preview failed.");
    } finally {
      setIsSending(false);
    }
  }

  function acceptPreview() {
    if (!pendingPreview) {
      return;
    }

    onApplyRevision(pendingPreview.version, pendingPreview.prompt);
    clearProtrusionPlacement();
    setPendingPreview(null);
    setNotice(pendingPreview.warning ? `Applied with note: ${pendingPreview.warning}` : "Protrusion applied.");
  }

  function rejectPreview() {
    setPendingPreview(null);
    setNotice("Protrusion preview rejected.");
  }

  return (
    <div className="mb-3 rounded border border-cyan-500/35 bg-cyan-500/10 p-3">
      {pendingPreview && version ? (
        <DiffPreviewOverlay
          baseVersion={version}
          dimensionOverlay={pendingPreview.dimensionOverlay}
          highlightRoomIds={hostRoomId ? [hostRoomId] : []}
          notice={[pendingPreview.warning, pendingPreview.gfaBasis].filter(Boolean).join(" ")}
          previewVersion={pendingPreview.version}
          title="Protrusion preview"
          onAccept={acceptPreview}
          onReject={rejectPreview}
        />
      ) : null}
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">
          <SquarePlus className="h-3.5 w-3.5" />
          Add Protrusion
        </div>
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={clearProtrusionPlacement}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear placement
        </button>
      </div>
      <p className="mb-2 text-xs text-muted">
        Click an exterior wall to place the protrusion center, set width, then describe the bump-out. GFA exemption uses
        project-configured thresholds with a verify-local-regulations notice.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted">
          Width (m)
          <input
            className="ml-2 w-20 rounded border border-line bg-[#0b1118] px-2 py-1 text-sm text-slate-100"
            max={6}
            min={0.6}
            step={0.1}
            type="number"
            value={protrusionWidthM}
            onChange={(event) => {
              const nextWidth = Number(event.target.value);
              setProtrusionWidthM(nextWidth);
              if (protrusionPlacement) {
                setProtrusionPlacement({ ...protrusionPlacement, widthM: nextWidth });
              }
            }}
          />
        </label>
        {selectedWall ? (
          <span className="text-xs text-muted">
            Wall {selectedWall.id} · position {(protrusionPlacement?.positionOnEdge ?? 0.5).toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-warning">Click a wall on the canvas to place the protrusion.</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="h-9 min-w-[240px] flex-1 rounded border border-line bg-[#0b1118] px-2 text-sm text-slate-100 outline-none focus:border-accent/70"
          disabled={isSending || Boolean(pendingPreview)}
          placeholder='e.g. add a shallow bay window with 0.45m depth'
          value={protrusionPrompt}
          onChange={(event) => setProtrusionPrompt(event.target.value)}
        />
        <button
          className="h-9 rounded bg-accent px-3 text-xs font-medium text-[#061014] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={
            isSending || Boolean(pendingPreview) || !selectedWall || !protrusionPrompt.trim() || !version
          }
          type="button"
          onClick={() => void submitProtrusion()}
        >
          {isSending ? "Generating..." : "Preview protrusion"}
        </button>
      </div>
      {notice ? <div className="mt-2 text-xs text-warning">{notice}</div> : null}
    </div>
  );
}
