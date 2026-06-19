"use client";

import { Armchair } from "lucide-react";
import { useState } from "react";
import { FurnitureCanvas } from "@/components/workflow/FurnitureCanvas";
import type { FurnitureLayout } from "@/lib/building-domain";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanVersion, Point } from "@/lib/project-types";

interface FurnitureWorkspaceProps {
  version?: PlanVersion;
  activeLevelId?: string;
  furnitureLayout?: FurnitureLayout;
  onLevelChange: (levelId: string) => void;
  onMoveFurnitureItem: (itemId: string, position: Point) => void;
}

export function FurnitureWorkspace({
  version,
  activeLevelId,
  furnitureLayout,
  onLevelChange,
  onMoveFurnitureItem
}: FurnitureWorkspaceProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();

  if (!version) {
    return (
      <div className="grid min-h-[520px] place-items-center rounded border border-dashed border-line bg-panel/60 text-sm text-muted">
        Generate or select a plan version to preview furniture placement by room type.
      </div>
    );
  }

  const activeLevel = version.levels.find((level) => level.id === activeLevelId) ?? version.levels[0];
  const resolvedLevel = activeLevel ? getResolvedLevel(version, activeLevel.id) : undefined;
  const levelItems = furnitureLayout?.items.filter((item) => item.levelId === activeLevel?.id) ?? [];
  const selectedItem = levelItems.find((item) => item.id === selectedItemId);
  const categoryCounts = levelItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section className="grid min-h-full grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)] gap-4">
      <div className="space-y-4 overflow-auto">
        <header className="rounded border border-line bg-panel/90 p-3">
          <h1 className="flex items-center gap-2 text-base font-semibold text-white">
            <Armchair className="h-4 w-4 text-accent" />
            Furniture layout
          </h1>
          <p className="mt-1 text-xs text-muted">
            Drag blocks on the plan to reposition. Positions persist on the domain model for the active scheme.
          </p>
        </header>

        {version.levels.length > 1 ? (
          <select
            className="h-8 w-full rounded border border-line bg-[#0b1118] px-2 text-xs text-slate-100"
            value={activeLevel?.id}
            onChange={(event) => {
              setSelectedItemId(undefined);
              onLevelChange(event.target.value);
            }}
          >
            {version.levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name}
              </option>
            ))}
          </select>
        ) : null}

        {selectedItem ? (
          <section className="rounded border border-accent/30 bg-accent/5 p-3 text-xs">
            <div className="font-medium text-white">{selectedItem.name}</div>
            <div className="mt-1 text-muted">
              {selectedItem.category} · {selectedItem.width}×{selectedItem.depth}m
            </div>
            <div className="mt-2 text-slate-200">
              Position {selectedItem.position[0].toFixed(1)}, {selectedItem.position[1].toFixed(1)}
            </div>
          </section>
        ) : null}

        <section className="rounded border border-line bg-panel/90 p-3">
          <h2 className="mb-2 text-sm font-semibold text-white">Level summary</h2>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Items" value={String(levelItems.length)} />
            {Object.entries(categoryCounts).map(([category, count]) => (
              <Metric key={category} label={category} value={String(count)} />
            ))}
          </dl>
        </section>

        <section className="max-h-80 space-y-2 overflow-auto rounded border border-line bg-panel/90 p-3">
          <h2 className="text-sm font-semibold text-white">Placements</h2>
          {levelItems.map((item) => (
            <button
              className={`w-full rounded border p-2 text-left text-xs ${
                item.id === selectedItemId
                  ? "border-accent/50 bg-accent/10 text-slate-100"
                  : "border-line bg-[#0b1118] text-slate-200 hover:border-accent/40"
              }`}
              key={item.id}
              type="button"
              onClick={() => setSelectedItemId(item.id)}
            >
              <div className="font-medium">{item.name}</div>
              <div className="mt-1 text-muted">
                {item.category} · {item.position[0].toFixed(1)}, {item.position[1].toFixed(1)}
              </div>
            </button>
          ))}
        </section>
      </div>

      <FurnitureCanvas
        version={version}
        rooms={resolvedLevel?.rooms ?? []}
        layout={furnitureLayout}
        levelId={activeLevel?.id}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
        onMoveItem={onMoveFurnitureItem}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-[#0b1118] p-2">
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 text-slate-100">{value}</dd>
    </div>
  );
}
