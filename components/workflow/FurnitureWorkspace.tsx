"use client";

import { Armchair } from "lucide-react";
import type { FurnitureLayout } from "@/lib/building-domain";
import type { PlanVersion } from "@/lib/project-types";

interface FurnitureWorkspaceProps {
  layout?: FurnitureLayout;
  activeVersion?: PlanVersion;
}

export function FurnitureWorkspace({ layout, activeVersion }: FurnitureWorkspaceProps) {
  const roomCount = activeVersion?.rooms.length ?? 0;
  const itemCount = layout?.items.length ?? 0;

  return (
    <section className="grid min-h-[520px] grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] gap-4">
      <div className="flex min-h-[480px] flex-col items-center justify-center rounded border border-dashed border-line bg-panel/60 p-8 text-center">
        <Armchair className="mb-4 h-10 w-10 text-muted" strokeWidth={1.25} />
        <h2 className="text-base font-semibold text-white">Furniture layout</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          Place fixtures and furnishings by room. This module will attach to the active plan and program spaces.
        </p>
        <span className="mt-4 rounded border border-line px-3 py-1 text-xs uppercase tracking-wide text-muted">
          Coming soon
        </span>
      </div>

      <aside className="rounded border border-line bg-panel/90 p-5">
        <h3 className="text-sm font-semibold text-white">Project context</h3>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Rooms in plan</dt>
            <dd className="font-medium text-slate-100">{roomCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Furniture items</dt>
            <dd className="font-medium text-slate-100">{itemCount}</dd>
          </div>
        </dl>

        {activeVersion && activeVersion.rooms.length > 0 ? (
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Rooms</p>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm text-slate-200">
              {activeVersion.rooms.slice(0, 12).map((room) => (
                <li key={room.id} className="rounded border border-line/60 bg-[#0b1118] px-2 py-1.5">
                  {room.name || room.id}
                </li>
              ))}
              {activeVersion.rooms.length > 12 ? (
                <li className="px-2 py-1 text-xs text-muted">
                  +{activeVersion.rooms.length - 12} more rooms
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">
            Generate or import a plan to preview rooms available for furniture placement.
          </p>
        )}
      </aside>
    </section>
  );
}
