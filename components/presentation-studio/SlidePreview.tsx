"use client";

import type { StudioSlide } from "@/lib/presentation-studio/types";

interface SlidePreviewProps {
  slide: StudioSlide;
  isActive?: boolean;
  onClick?: () => void;
}

export function SlidePreview({ slide, isActive = false, onClick }: SlidePreviewProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex aspect-video w-full flex-col overflow-hidden rounded border bg-white text-left transition-all ${
        isActive
          ? "border-accent shadow-lg shadow-accent/20"
          : "border-line hover:border-accent/50 hover:shadow-md"
      }`}
    >
      {/* 幻灯片内容预览 */}
      <div className="flex-1 p-3">
        {slide.title && (
          <div className="mb-2 text-sm font-bold text-slate-900 line-clamp-2">
            {slide.title}
          </div>
        )}
        {slide.subtitle && (
          <div className="mb-2 text-xs text-slate-600 line-clamp-1">
            {slide.subtitle}
          </div>
        )}
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className="space-y-1">
            {slide.bullets.slice(0, 3).map((bullet, i) => (
              <li key={i} className="flex items-start gap-1 text-[10px] text-slate-700">
                <span className="text-accent">•</span>
                <span className="line-clamp-1">{bullet}</span>
              </li>
            ))}
            {slide.bullets.length > 3 && (
              <li className="text-[10px] text-slate-500">+{slide.bullets.length - 3} more</li>
            )}
          </ul>
        )}
        {slide.content && !slide.bullets && (
          <p className="text-[10px] text-slate-700 line-clamp-3">{slide.content}</p>
        )}
      </div>

      {/* 底部信息栏 */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-2 py-1">
        <span className="text-[9px] text-slate-500">{slide.type}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[8px] text-white ${
            slide.status === "finalized"
              ? "bg-purple-500"
              : slide.status === "edited"
                ? "bg-yellow-500"
                : slide.status === "generated"
                  ? "bg-green-500"
                  : slide.status === "generating"
                    ? "bg-blue-500"
                    : "bg-gray-400"
          }`}
        >
          {slide.status === "finalized"
            ? "完成"
            : slide.status === "edited"
              ? "已编辑"
              : slide.status === "generated"
                ? "已生成"
                : slide.status === "generating"
                  ? "生成中"
                  : "草稿"}
        </span>
      </div>

      {/* 选中指示器 */}
      {isActive && (
        <div className="absolute inset-0 rounded border-2 border-accent pointer-events-none" />
      )}
    </button>
  );
}
