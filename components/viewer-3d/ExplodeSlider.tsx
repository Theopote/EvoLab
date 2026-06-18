"use client";

import { useInteractionStore } from "@/lib/interaction-store";

interface ExplodeSliderProps {
  className?: string;
}

export function ExplodeSlider({ className }: ExplodeSliderProps) {
  const explodeFactor = useInteractionStore((state) => state.explodeFactor);
  const setExplodeFactor = useInteractionStore((state) => state.setExplodeFactor);

  return (
    <label className={`flex items-center gap-3 text-xs text-muted ${className ?? ""}`}>
      <span className="shrink-0 uppercase tracking-[0.12em]">Explode</span>
      <input
        className="h-1.5 w-full cursor-pointer accent-[#4fb5c8]"
        max={1}
        min={0}
        step={0.05}
        type="range"
        value={explodeFactor}
        onChange={(event) => setExplodeFactor(Number(event.target.value))}
      />
      <span className="w-8 shrink-0 text-right text-slate-200">{Math.round(explodeFactor * 100)}%</span>
    </label>
  );
}
