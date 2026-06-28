"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Grid3x3, Maximize2 } from "lucide-react";
import type { PresentationDocument } from "@/lib/presentation-studio/types";
import { SlidePreview } from "./SlidePreview";

interface PreviewModeProps {
  document: PresentationDocument;
  activeSlideId: string | null;
  onSelectSlide: (slideId: string) => void;
}

export function PreviewMode({ document, activeSlideId, onSelectSlide }: PreviewModeProps) {
  const [viewMode, setViewMode] = useState<"grid" | "single">("grid");
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeSlide = document.slides.find((s) => s.id === activeSlideId);
  const activeIndex = activeSlideId
    ? document.slides.findIndex((s) => s.id === activeSlideId)
    : 0;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      onSelectSlide(document.slides[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentIndex < document.slides.length - 1) {
      setCurrentIndex(currentIndex + 1);
      onSelectSlide(document.slides[currentIndex + 1].id);
    }
  };

  if (viewMode === "single") {
    const slide = document.slides[currentIndex];

    return (
      <div className="flex h-full flex-col bg-[#0b1118]">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between border-b border-line bg-panel/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="rounded border border-line p-1.5 text-slate-300 hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-slate-300">
              {currentIndex + 1} / {document.slides.length}
            </span>
            <button
              onClick={handleNext}
              disabled={currentIndex === document.slides.length - 1}
              className="rounded border border-line p-1.5 text-slate-300 hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-slate-300 hover:border-accent/50 hover:text-accent"
          >
            <Grid3x3 className="h-3.5 w-3.5" />
            网格视图
          </button>
        </div>

        {/* 单页预览 */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-5xl">
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-line bg-white shadow-2xl">
              <div className="flex h-full flex-col p-12">
                {slide.title && (
                  <h1 className="mb-4 text-4xl font-bold text-slate-900">
                    {slide.title}
                  </h1>
                )}
                {slide.subtitle && (
                  <h2 className="mb-6 text-xl text-slate-600">
                    {slide.subtitle}
                  </h2>
                )}

                <div className="flex-1 overflow-y-auto">
                  {slide.bullets && slide.bullets.length > 0 ? (
                    <ul className="space-y-3">
                      {slide.bullets.map((bullet, i) => (
                        <li key={i} className="flex items-start gap-3 text-lg text-slate-700">
                          <span className="mt-1.5 text-accent">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : slide.content ? (
                    <div className="whitespace-pre-wrap text-lg leading-relaxed text-slate-700">
                      {slide.content}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-slate-400">
                      暂无内容
                    </div>
                  )}
                </div>

                {slide.imageCaption && (
                  <div className="mt-6 rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                    <span className="text-2xl">📷</span>
                    <p className="mt-2 text-sm text-slate-600">{slide.imageCaption}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 演讲备注 */}
            {slide.notes && (
              <div className="mt-4 rounded-lg border border-line bg-panel/30 p-4">
                <h3 className="mb-2 text-xs font-semibold text-slate-400">演讲备注</h3>
                <p className="text-sm text-slate-300">{slide.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 网格视图
  return (
    <div className="h-full overflow-y-auto bg-[#0b1118] p-6">
      {/* 顶部工具栏 */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          预览模式 ({document.slides.length} 张幻灯片)
        </h2>
        <button
          onClick={() => {
            setViewMode("single");
            setCurrentIndex(activeIndex);
          }}
          className="flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs text-slate-300 hover:border-accent/50 hover:text-accent"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          全屏预览
        </button>
      </div>

      {/* 幻灯片网格 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {document.slides.map((slide, index) => (
          <div key={slide.id} className="space-y-2">
            <div className="text-xs text-muted">第 {index + 1} 页</div>
            <SlidePreview
              slide={slide}
              isActive={slide.id === activeSlideId}
              onClick={() => onSelectSlide(slide.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
