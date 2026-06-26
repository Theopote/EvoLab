"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  bulletsFromMultilineText,
  multilineTextFromBullets
} from "@/lib/presentation/deck-mutations";
import type { PresentationDeck, PresentationSlide } from "@/lib/presentation/types";

interface PresentationSlideEditorProps {
  deck: PresentationDeck;
  slide: PresentationSlide;
  slideIndex: number;
  slideCount: number;
  onUpdateSlide: (patch: Partial<Pick<PresentationSlide, "title" | "subtitle" | "bullets">>) => void;
  onUpdateDeckMeta: (patch: Partial<Pick<PresentationDeck, "storyArc" | "designNarrative">>) => void;
  onRemoveSlide: () => void;
  onMoveSlide: (direction: "up" | "down") => void;
}

export function PresentationSlideEditor({
  deck,
  slide,
  slideIndex,
  slideCount,
  onUpdateSlide,
  onUpdateDeckMeta,
  onRemoveSlide,
  onMoveSlide
}: PresentationSlideEditorProps) {
  const [title, setTitle] = useState(slide.title);
  const [subtitle, setSubtitle] = useState(slide.subtitle ?? "");
  const [bulletsText, setBulletsText] = useState(multilineTextFromBullets(slide.bullets));
  const [storyArcText, setStoryArcText] = useState((deck.storyArc ?? []).join("\n"));

  useEffect(() => {
    setTitle(slide.title);
    setSubtitle(slide.subtitle ?? "");
    setBulletsText(multilineTextFromBullets(slide.bullets));
  }, [slide.id, slide.title, slide.subtitle, slide.bullets]);

  useEffect(() => {
    setStoryArcText((deck.storyArc ?? []).join("\n"));
  }, [deck.storyArc]);

  return (
    <aside className="space-y-4 text-xs">
      <header>
        <h3 className="text-sm font-semibold text-white">编辑幻灯片</h3>
        <p className="mt-1 text-muted">修改标题与要点后导出 PPTX，文本可在 PowerPoint 中继续调整。</p>
      </header>

      <label className="block space-y-1">
        <span className="text-muted">标题</span>
        <input
          className="h-9 w-full rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100 outline-none focus:border-accent/50"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (title.trim() && title !== slide.title) {
              onUpdateSlide({ title: title.trim() });
            }
          }}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-muted">副标题</span>
        <input
          className="h-9 w-full rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100 outline-none focus:border-accent/50"
          value={subtitle}
          onChange={(event) => setSubtitle(event.target.value)}
          onBlur={() => {
            const next = subtitle.trim();
            if (next !== (slide.subtitle ?? "")) {
              onUpdateSlide({ subtitle: next || undefined });
            }
          }}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-muted">要点（每行一条）</span>
        <textarea
          className="min-h-28 w-full rounded border border-line bg-[#0b1118] px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent/50"
          value={bulletsText}
          onChange={(event) => setBulletsText(event.target.value)}
          onBlur={() => {
            const bullets = bulletsFromMultilineText(bulletsText);
            if (JSON.stringify(bullets) !== JSON.stringify(slide.bullets)) {
              onUpdateSlide({ bullets });
            }
          }}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-muted">故事线（每行一阶段）</span>
        <textarea
          className="min-h-20 w-full rounded border border-line bg-[#0b1118] px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent/50"
          value={storyArcText}
          onChange={(event) => setStoryArcText(event.target.value)}
          onBlur={() => {
            const storyArc = bulletsFromMultilineText(storyArcText);
            if (JSON.stringify(storyArc) !== JSON.stringify(deck.storyArc ?? [])) {
              onUpdateDeckMeta({ storyArc });
            }
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-line px-2 py-1 text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
          disabled={slideIndex === 0}
          type="button"
          onClick={() => onMoveSlide("up")}
        >
          上移
        </button>
        <button
          className="rounded border border-line px-2 py-1 text-muted hover:border-accent/50 hover:text-accent disabled:opacity-40"
          disabled={slideIndex >= slideCount - 1}
          type="button"
          onClick={() => onMoveSlide("down")}
        >
          下移
        </button>
        <button
          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-muted hover:border-danger/50 hover:text-danger disabled:opacity-40"
          disabled={slideCount <= 1}
          type="button"
          onClick={onRemoveSlide}
        >
          <Trash2 className="h-3.5 w-3.5" />
          移除页
        </button>
      </div>
    </aside>
  );
}
