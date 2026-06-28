"use client";

import { useState } from "react";
import { Sparkles, Save, RotateCcw, Copy } from "lucide-react";
import type { StudioSlide } from "@/lib/presentation-studio/types";

interface SlideEditorProps {
  slide: StudioSlide;
  onUpdateSlide: (updates: Partial<StudioSlide>) => void;
  onAIModify: (request: string) => void;
  onSave: () => void;
  isModifying?: boolean;
}

export function SlideEditor({
  slide,
  onUpdateSlide,
  onAIModify,
  onSave,
  isModifying = false
}: SlideEditorProps) {
  const [aiRequest, setAiRequest] = useState("");
  const [editMode, setEditMode] = useState<"view" | "edit">("view");

  const handleAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (aiRequest.trim()) {
      onAIModify(aiRequest.trim());
      setAiRequest("");
    }
  };

  const getStatusBadge = () => {
    const badges = {
      draft: { label: "草稿", color: "bg-gray-500" },
      generating: { label: "生成中", color: "bg-blue-500" },
      generated: { label: "AI生成", color: "bg-green-500" },
      edited: { label: "已编辑", color: "bg-yellow-500" },
      finalized: { label: "已完成", color: "bg-purple-500" }
    };

    const badge = badges[slide.status];
    return (
      <span className={`${badge.color} rounded px-2 py-0.5 text-[10px] text-white`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col bg-panel/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white">幻灯片编辑</h3>
          {getStatusBadge()}
          <span className="text-xs text-muted">类型: {slide.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditMode(editMode === "view" ? "edit" : "view")}
            className="rounded border border-line px-3 py-1 text-xs text-slate-200 hover:border-accent/60 hover:text-accent"
          >
            {editMode === "view" ? "编辑模式" : "预览模式"}
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 rounded bg-accent px-3 py-1 text-xs text-white hover:bg-accent/80"
          >
            <Save className="h-3 w-3" />
            保存
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Title */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted">标题</label>
            {editMode === "edit" ? (
              <input
                className="w-full rounded border border-line bg-[#0b1118] p-3 text-lg font-semibold text-white outline-none focus:border-accent/70"
                value={slide.title || ""}
                onChange={(e) => onUpdateSlide({ title: e.target.value })}
                placeholder="输入标题..."
              />
            ) : (
              <div className="text-2xl font-bold text-white">{slide.title || "未命名"}</div>
            )}
          </div>

          {/* Subtitle */}
          {(editMode === "edit" || slide.subtitle) && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">副标题</label>
              {editMode === "edit" ? (
                <input
                  className="w-full rounded border border-line bg-[#0b1118] p-2 text-sm text-slate-200 outline-none focus:border-accent/70"
                  value={slide.subtitle || ""}
                  onChange={(e) => onUpdateSlide({ subtitle: e.target.value })}
                  placeholder="输入副标题（可选）..."
                />
              ) : (
                <div className="text-lg text-slate-300">{slide.subtitle}</div>
              )}
            </div>
          )}

          {/* Content / Bullets */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted">内容</label>
            {editMode === "edit" ? (
              <>
                {slide.bullets && slide.bullets.length > 0 ? (
                  <div className="space-y-2">
                    {slide.bullets.map((bullet, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="mt-2 text-accent">•</span>
                        <input
                          className="flex-1 rounded border border-line bg-[#0b1118] p-2 text-sm text-slate-200 outline-none focus:border-accent/70"
                          value={bullet}
                          onChange={(e) => {
                            const newBullets = [...(slide.bullets || [])];
                            newBullets[index] = e.target.value;
                            onUpdateSlide({ bullets: newBullets });
                          }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newBullets = [...(slide.bullets || []), ""];
                        onUpdateSlide({ bullets: newBullets });
                      }}
                      className="text-xs text-accent hover:underline"
                    >
                      + 添加要点
                    </button>
                  </div>
                ) : (
                  <textarea
                    className="min-h-32 w-full resize-none rounded border border-line bg-[#0b1118] p-3 text-sm leading-6 text-slate-200 outline-none focus:border-accent/70"
                    value={slide.content || ""}
                    onChange={(e) => onUpdateSlide({ content: e.target.value })}
                    placeholder="输入内容..."
                  />
                )}
              </>
            ) : (
              <>
                {slide.bullets && slide.bullets.length > 0 ? (
                  <ul className="space-y-2">
                    {slide.bullets.map((bullet, index) => (
                      <li key={index} className="flex items-start gap-2 text-slate-200">
                        <span className="text-accent">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="whitespace-pre-wrap text-slate-200">{slide.content || "暂无内容"}</div>
                )}
              </>
            )}
          </div>

          {/* Image Caption */}
          {(editMode === "edit" || slide.imageCaption) && (
            <div>
              <label className="mb-2 block text-xs font-medium text-muted">图片说明</label>
              {editMode === "edit" ? (
                <input
                  className="w-full rounded border border-line bg-[#0b1118] p-2 text-sm text-slate-200 outline-none focus:border-accent/70"
                  value={slide.imageCaption || ""}
                  onChange={(e) => onUpdateSlide({ imageCaption: e.target.value })}
                  placeholder="描述所需图片..."
                />
              ) : (
                <div className="rounded border border-dashed border-line p-4 text-center text-sm text-muted">
                  📷 {slide.imageCaption}
                </div>
              )}
            </div>
          )}

          {/* Speaker Notes */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted">演讲备注</label>
            {editMode === "edit" ? (
              <textarea
                className="min-h-24 w-full resize-none rounded border border-line bg-[#0b1118] p-3 text-xs leading-5 text-slate-200 outline-none focus:border-accent/70"
                value={slide.notes || ""}
                onChange={(e) => onUpdateSlide({ notes: e.target.value })}
                placeholder="输入演讲备注..."
              />
            ) : (
              <div className="text-xs text-muted">{slide.notes || "无备注"}</div>
            )}
          </div>
        </div>
      </div>

      {/* AI Modify Panel */}
      <div className="border-t border-line bg-[#0b1118] p-4">
        <form onSubmit={handleAISubmit} className="flex gap-2">
          <input
            className="flex-1 rounded border border-line bg-panel px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent/70"
            value={aiRequest}
            onChange={(e) => setAiRequest(e.target.value)}
            placeholder="告诉AI如何修改这张幻灯片..."
            disabled={isModifying}
          />
          <button
            type="submit"
            disabled={!aiRequest.trim() || isModifying}
            className="flex items-center gap-2 rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isModifying ? "生成中..." : "AI修改"}
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span>示例:</span>
          <button
            onClick={() => setAiRequest("把标题改短一点")}
            className="text-accent hover:underline"
          >
            改短标题
          </button>
          <button
            onClick={() => setAiRequest("内容更详细一些")}
            className="text-accent hover:underline"
          >
            更详细
          </button>
          <button
            onClick={() => setAiRequest("语气更专业")}
            className="text-accent hover:underline"
          >
            更专业
          </button>
        </div>
      </div>
    </div>
  );
}
