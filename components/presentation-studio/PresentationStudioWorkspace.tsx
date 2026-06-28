"use client";

import { useEffect, useState } from "react";
import { Sparkles, FileDown, Eye, Edit3, Layout, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { OutlineEditor } from "@/components/presentation-studio/OutlineEditor";
import { SlideEditor } from "@/components/presentation-studio/SlideEditor";
import { PreviewMode } from "@/components/presentation-studio/PreviewMode";
import { usePresentationStudio } from "@/lib/presentation-studio/store";
import type {
  GenerateOutlineResponse,
  GenerateSlideContentResponse,
  ModifySlideResponse
} from "@/lib/presentation-studio/types";

export function PresentationStudioWorkspace() {
  const {
    getActiveDocument,
    getActiveSlide,
    activeSlideId,
    setActiveSlide,
    updateDocument,
    updateSlide,
    viewMode,
    setViewMode,
    sidebarOpen,
    setSidebarOpen,
    isGenerating,
    setGenerating
  } = usePresentationStudio();

  const [showOutlineGenerator, setShowOutlineGenerator] = useState(false);
  const [outlineTopic, setOutlineTopic] = useState("");

  const activeDocument = getActiveDocument();
  const activeSlide = getActiveSlide();

  useEffect(() => {
    // 如果文档存在但没有大纲，显示大纲生成器
    if (activeDocument && activeDocument.outline.sections.length === 0) {
      setShowOutlineGenerator(true);
    }
  }, [activeDocument]);

  const handleGenerateOutline = async () => {
    if (!activeDocument || !outlineTopic.trim()) return;

    setGenerating(true);
    try {
      const response = await fetch("/api/studio/generate-outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: outlineTopic,
          slideCount: 12
        })
      });

      if (response.ok) {
        const data: GenerateOutlineResponse = await response.json();
        updateDocument(activeDocument.id, { outline: data.outline });
        setShowOutlineGenerator(false);
      }
    } catch (error) {
      console.error("Failed to generate outline:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSlide = async (slideId: string) => {
    if (!activeDocument) return;

    // 找到对应的outline item
    let outlineItem;
    for (const section of activeDocument.outline.sections) {
      const item = section.slides.find((s) => s.id === slideId);
      if (item) {
        outlineItem = item;
        break;
      }
    }

    if (!outlineItem) return;

    setGenerating(true, [slideId]);
    try {
      const response = await fetch("/api/studio/generate-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId: activeDocument.id,
          slideId,
          outlineItem
        })
      });

      if (response.ok) {
        const data: GenerateSlideContentResponse = await response.json();
        // 添加或更新幻灯片
        const existingSlide = activeDocument.slides.find((s) => s.id === slideId);
        if (existingSlide) {
          updateSlide(activeDocument.id, slideId, data.slide);
        } else {
          // TODO: 使用store的addSlide方法
        }
      }
    } catch (error) {
      console.error("Failed to generate slide:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!activeDocument) return;

    const slideIds = activeDocument.outline.sections.flatMap((s) => s.slides.map((sl) => sl.id));

    for (const slideId of slideIds) {
      await handleGenerateSlide(slideId);
    }
  };

  const handleAIModifySlide = async (request: string) => {
    if (!activeDocument || !activeSlide) return;

    setGenerating(true, [activeSlide.id]);
    try {
      const response = await fetch("/api/studio/modify-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId: activeDocument.id,
          slideId: activeSlide.id,
          currentSlide: activeSlide,
          userRequest: request
        })
      });

      if (response.ok) {
        const data: ModifySlideResponse = await response.json();
        updateSlide(activeDocument.id, activeSlide.id, data.slide);
      }
    } catch (error) {
      console.error("Failed to modify slide:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPPTX = async () => {
    if (!activeDocument) return;

    try {
      setGenerating(true);
      const response = await fetch("/api/studio/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeDocument)
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeDocument.title}.pptx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const error = await response.json();
        console.error("Export failed:", error);
        alert(`导出失败: ${error.error}`);
      }
    } catch (error) {
      console.error("Export failed:", error);
      alert("导出失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  if (!activeDocument) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <Sparkles className="mx-auto h-12 w-12 text-accent" />
          <h2 className="mt-4 text-xl font-semibold text-white">Presentation Studio</h2>
          <p className="mt-2 text-sm text-muted">请先创建或打开一个演示文稿</p>
        </div>
      </div>
    );
  }

  // 大纲生成器
  if (showOutlineGenerator) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas p-8">
        <div className="w-full max-w-2xl rounded-lg border border-line bg-panel p-8">
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-semibold text-white">生成演示文稿大纲</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="outline-topic" className="mb-2 block text-sm font-medium text-slate-200">
                演示文稿主题
              </label>
              <input
                id="outline-topic"
                className="w-full rounded border border-line bg-[#0b1118] p-3 text-white outline-none focus:border-accent/70"
                value={outlineTopic}
                onChange={(e) => setOutlineTopic(e.target.value)}
                placeholder="例如：某医院建筑设计方案汇报"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGenerateOutline}
                disabled={!outlineTopic.trim() || isGenerating}
                className="flex-1 rounded bg-accent px-4 py-3 font-medium text-white hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "生成中..." : "AI生成大纲"}
              </button>
              <button
                onClick={() => {
                  setShowOutlineGenerator(false);
                  // 手动创建空大纲
                  updateDocument(activeDocument.id, {
                    outline: {
                      title: activeDocument.title,
                      sections: [
                        {
                          id: `section_${Date.now()}`,
                          title: "第一章",
                          slideCount: 0,
                          slides: []
                        }
                      ],
                      totalSlides: 0
                    }
                  });
                }}
                className="rounded border border-line px-4 py-3 text-slate-200 hover:bg-panel/50"
              >
                手动创建
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-canvas">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-line bg-[#0b1118] px-6 py-3">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="rounded border border-line p-2 text-muted hover:border-accent/50 hover:text-accent"
            aria-label="返回首页"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold text-white">{activeDocument.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("outline")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${
              viewMode === "outline"
                ? "bg-accent/20 text-accent"
                : "text-muted hover:bg-panel/50"
            }`}
          >
            <Layout className="h-3.5 w-3.5" />
            大纲
          </button>
          <button
            onClick={() => setViewMode("slide-editor")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${
              viewMode === "slide-editor"
                ? "bg-accent/20 text-accent"
                : "text-muted hover:bg-panel/50"
            }`}
            disabled={!activeSlide}
          >
            <Edit3 className="h-3.5 w-3.5" />
            编辑
          </button>
          <button
            onClick={() => setViewMode("preview")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${
              viewMode === "preview"
                ? "bg-accent/20 text-accent"
                : "text-muted hover:bg-panel/50"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            预览
          </button>

          <div className="mx-2 h-6 w-px bg-line" />

          <button
            onClick={handleExportPPTX}
            className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
          >
            <FileDown className="h-3.5 w-3.5" />
            导出PPTX
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Outline */}
        {sidebarOpen && (
          <div className="w-80 border-r border-line">
            <OutlineEditor
              outline={activeDocument.outline}
              onUpdateOutline={(outline) => updateDocument(activeDocument.id, { outline })}
              onGenerateSlide={handleGenerateSlide}
              onGenerateAll={handleGenerateAll}
              selectedSlideId={activeSlideId ?? undefined}
              onSelectSlide={setActiveSlide}
            />
          </div>
        )}

        {/* Main Editor */}
        <div className="flex-1">
          {viewMode === "outline" && (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center text-muted">
                <Layout className="mx-auto h-12 w-12" />
                <p className="mt-4">在左侧大纲中选择幻灯片开始编辑</p>
              </div>
            </div>
          )}

          {viewMode === "slide-editor" && activeSlide && (
            <SlideEditor
              slide={activeSlide}
              onUpdateSlide={(updates) => updateSlide(activeDocument.id, activeSlide.id, updates)}
              onAIModify={handleAIModifySlide}
              onSave={() => {
                // TODO: 实现保存逻辑
              }}
              isModifying={isGenerating}
            />
          )}

          {viewMode === "preview" && (
            <PreviewMode
              document={activeDocument}
              activeSlideId={activeSlideId}
              onSelectSlide={setActiveSlide}
            />
          )}
        </div>
      </div>
    </div>
  );
}
