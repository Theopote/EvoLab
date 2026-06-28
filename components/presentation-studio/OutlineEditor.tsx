"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from "lucide-react";
import type { PresentationOutline, OutlineSection, OutlineSlideItem } from "@/lib/presentation-studio/types";

interface OutlineEditorProps {
  outline: PresentationOutline;
  onUpdateOutline: (outline: PresentationOutline) => void;
  onGenerateSlide: (slideId: string) => void;
  onGenerateAll: () => void;
  selectedSlideId?: string;
  onSelectSlide: (slideId: string) => void;
}

export function OutlineEditor({
  outline,
  onUpdateOutline,
  onGenerateSlide,
  onGenerateAll,
  selectedSlideId,
  onSelectSlide
}: OutlineEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(outline.sections.map((s) => s.id))
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const addSlide = (sectionId: string) => {
    const newSlide: OutlineSlideItem = {
      id: `slide_${Date.now()}`,
      title: "新幻灯片",
      type: "content"
    };

    const updatedSections = outline.sections.map((section) => {
      if (section.id === sectionId) {
        return {
          ...section,
          slides: [...section.slides, newSlide],
          slideCount: section.slideCount + 1
        };
      }
      return section;
    });

    onUpdateOutline({
      ...outline,
      sections: updatedSections,
      totalSlides: outline.totalSlides + 1
    });
  };

  const deleteSlide = (sectionId: string, slideId: string) => {
    const updatedSections = outline.sections.map((section) => {
      if (section.id === sectionId) {
        return {
          ...section,
          slides: section.slides.filter((s) => s.id !== slideId),
          slideCount: section.slideCount - 1
        };
      }
      return section;
    });

    onUpdateOutline({
      ...outline,
      sections: updatedSections,
      totalSlides: outline.totalSlides - 1
    });
  };

  const updateSlideTitle = (sectionId: string, slideId: string, title: string) => {
    const updatedSections = outline.sections.map((section) => {
      if (section.id === sectionId) {
        return {
          ...section,
          slides: section.slides.map((slide) =>
            slide.id === slideId ? { ...slide, title } : slide
          )
        };
      }
      return section;
    });

    onUpdateOutline({
      ...outline,
      sections: updatedSections
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#0b1118]">
      {/* Header */}
      <div className="border-b border-line p-4">
        <div className="mb-2">
          <input
            className="w-full bg-transparent text-lg font-semibold text-white outline-none"
            value={outline.title}
            onChange={(e) => onUpdateOutline({ ...outline, title: e.target.value })}
            placeholder="演示文稿标题"
          />
          {outline.subtitle !== undefined && (
            <input
              className="mt-1 w-full bg-transparent text-sm text-muted outline-none"
              value={outline.subtitle}
              onChange={(e) => onUpdateOutline({ ...outline, subtitle: e.target.value })}
              placeholder="副标题（可选）"
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{outline.totalSlides} 张幻灯片</span>
          <button
            onClick={onGenerateAll}
            className="rounded bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
          >
            批量生成全部
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {outline.sections.map((section, sectionIdx) => (
          <div key={section.id} className="border-b border-line">
            {/* Section Header */}
            <button
              className="flex w-full items-center gap-2 p-3 text-left hover:bg-panel/30"
              onClick={() => toggleSection(section.id)}
            >
              {expandedSections.has(section.id) ? (
                <ChevronDown className="h-4 w-4 text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{section.title}</div>
                {section.description && (
                  <div className="text-xs text-muted">{section.description}</div>
                )}
              </div>
              <span className="text-xs text-muted">{section.slideCount} 页</span>
            </button>

            {/* Slides */}
            {expandedSections.has(section.id) && (
              <div className="bg-panel/10">
                {section.slides.map((slide, slideIdx) => (
                  <div
                    key={slide.id}
                    className={`flex items-center gap-2 px-4 py-2 hover:bg-panel/20 ${
                      selectedSlideId === slide.id ? "bg-accent/10 border-l-2 border-accent" : ""
                    }`}
                  >
                    <GripVertical className="h-3.5 w-3.5 cursor-move text-muted" />
                    <span className="w-6 text-xs text-muted">{sectionIdx + 1}.{slideIdx + 1}</span>
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-200 outline-none"
                      value={slide.title}
                      onChange={(e) => updateSlideTitle(section.id, slide.id, e.target.value)}
                      onClick={() => onSelectSlide(slide.id)}
                    />
                    <button
                      onClick={() => onGenerateSlide(slide.id)}
                      className="rounded px-2 py-1 text-xs text-accent hover:bg-accent/10"
                    >
                      生成
                    </button>
                    <button
                      onClick={() => deleteSlide(section.id, slide.id)}
                      className="text-muted hover:text-red-400"
                      aria-label="删除幻灯片"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addSlide(section.id)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs text-muted hover:bg-panel/20 hover:text-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加幻灯片
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
