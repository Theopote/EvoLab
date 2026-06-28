"use client";

import { useInteractionStore } from "@/lib/interaction-store";

interface ExplodeSliderProps {
  className?: string;
}

export function ExplodeSlider({ className }: ExplodeSliderProps) {
  const explodeFactor = useInteractionStore((state) => state.explodeFactor);
  const setExplodeFactor = useInteractionStore((state) => state.setExplodeFactor);

  return (
    <label htmlFor="explode-slider" className={`flex items-center gap-3 text-xs text-muted ${className ?? ""}`}>
      <span className="shrink-0 uppercase tracking-[0.12em]">Explode</span>
      <input
        id="explode-slider"
        className="h-1.5 w-full cursor-pointer accent-[#4fb5c8]"
        max={1}
        min={0}
        step={0.05}
        type="range"
        value={explodeFactor}
        onChange={(event) => setExplodeFactor(Number(event.target.value))}
        aria-label="楼层分解程度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(explodeFactor * 100)}
        aria-valuetext={`${Math.round(explodeFactor * 100)}%`}
      />
      <span className="w-8 shrink-0 text-right text-slate-200" aria-hidden="true">{Math.round(explodeFactor * 100)}%</span>
    </label>
  );
}
