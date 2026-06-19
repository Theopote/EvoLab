"use client";

import type { ReportDocument, Slide, SlideLayout } from "@/lib/report-types";
import { resolveBlockFromLayout } from "@/lib/report-layout-engine";

interface SlideEditorProps {
  document: ReportDocument;
  layout: SlideLayout;
  activeSlideId?: string;
  onSelectSlide: (slideId: string) => void;
  onElementMove: (slideId: string, blockRef: string, patch: { x: number; y: number }) => void;
  onElementResize: (slideId: string, blockRef: string, patch: { w: number; h: number }) => void;
}

export function SlideEditor({
  document,
  layout,
  activeSlideId,
  onSelectSlide,
  onElementMove,
  onElementResize
}: SlideEditorProps) {
  const activeSlide = layout.slides.find((slide) => slide.id === activeSlideId) ?? layout.slides[0];

  return (
    <div className="grid min-h-0 grid-cols-[180px_minmax(0,1fr)] gap-3">
      <div className="space-y-1 overflow-auto">
        {layout.slides.map((slide, index) => (
          <button
            className={`w-full rounded border px-2 py-2 text-left text-xs ${
              slide.id === activeSlide?.id ? "border-accent/60 text-accent" : "border-line text-muted"
            }`}
            key={slide.id}
            type="button"
            onClick={() => onSelectSlide(slide.id)}
          >
            Slide {index + 1}
          </button>
        ))}
      </div>

      {activeSlide ? (
        <SlideCanvas
          document={document}
          slide={activeSlide}
          onElementMove={onElementMove}
          onElementResize={onElementResize}
        />
      ) : null}
    </div>
  );
}

function SlideCanvas({
  document,
  slide,
  onElementMove,
  onElementResize
}: {
  document: ReportDocument;
  slide: Slide;
  onElementMove: SlideEditorProps["onElementMove"];
  onElementResize: SlideEditorProps["onElementResize"];
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded border border-line bg-[#101820]">
      {slide.elements.map((element) => {
        const resolved = resolveBlockFromLayout(document, element.blockRef);
        const preview =
          resolved?.block.type === "paragraph"
            ? resolved.block.content
            : resolved?.block.type === "bullet_list"
              ? (resolved.block.bullets ?? []).join(" · ")
              : resolved?.block.type === "table"
                ? (resolved.block.table?.rows ?? [])[0]?.join(" | ")
                : resolved?.block.imageRef?.caption ?? element.blockRef;

        return (
          <div
            className="absolute cursor-move overflow-hidden rounded border border-accent/40 bg-white/[0.04] p-2 text-[11px] leading-4 text-slate-100"
            key={`${slide.id}-${element.blockRef}`}
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              width: `${element.w}%`,
              height: `${element.h}%`
            }}
            onPointerDown={(event) => {
              const startX = event.clientX;
              const startY = event.clientY;
              const origin = { x: element.x, y: element.y };

              function onMove(moveEvent: PointerEvent) {
                const dx = ((moveEvent.clientX - startX) / event.currentTarget.parentElement!.clientWidth) * 100;
                const dy = ((moveEvent.clientY - startY) / event.currentTarget.parentElement!.clientHeight) * 100;
                onElementMove(slide.id, element.blockRef, {
                  x: Math.max(0, Math.min(92, origin.x + dx)),
                  y: Math.max(0, Math.min(92, origin.y + dy))
                });
              }

              function onUp() {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              }

              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }}
          >
            <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">{element.blockRef}</div>
            <div className="line-clamp-6">{preview}</div>
            <button
              className="absolute bottom-1 right-1 h-3 w-3 rounded-sm border border-accent/60 bg-accent/30"
              type="button"
              aria-label="Resize"
              onPointerDown={(event) => {
                event.stopPropagation();
                const startX = event.clientX;
                const startY = event.clientY;
                const origin = { w: element.w, h: element.h };

                function onMove(moveEvent: PointerEvent) {
                  const dw = ((moveEvent.clientX - startX) / event.currentTarget.parentElement!.clientWidth) * 100;
                  const dh = ((moveEvent.clientY - startY) / event.currentTarget.parentElement!.clientHeight) * 100;
                  onElementResize(slide.id, element.blockRef, {
                    w: Math.max(12, Math.min(96, origin.w + dw)),
                    h: Math.max(10, Math.min(96, origin.h + dh))
                  });
                }

                function onUp() {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                }

                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
