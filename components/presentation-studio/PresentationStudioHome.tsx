"use client";

import { Plus, FileText, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePresentationStudio } from "@/lib/presentation-studio/store";

export function PresentationStudioHome() {
  const { documents, createDocument, setActiveDocument } = usePresentationStudio();

  const handleCreateNew = () => {
    const newDoc = createDocument("新演示文稿");
    setActiveDocument(newDoc.id);
    window.location.href = "/presentation-studio";
  };

  const recentDocuments = documents
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-canvas p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold text-white">Presentation Studio</h1>
          </div>
          <p className="text-muted">AI辅助的演示文稿编辑器 - 独立工作或从项目导入</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <button
            onClick={handleCreateNew}
            className="group flex items-center gap-4 rounded-lg border-2 border-dashed border-line p-6 text-left hover:border-accent/50 hover:bg-panel/30"
          >
            <div className="rounded-full bg-accent/20 p-3 group-hover:bg-accent/30">
              <Plus className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-white">创建新演示文稿</h3>
              <p className="text-sm text-muted">从空白或AI生成大纲开始</p>
            </div>
          </button>

          <Link
            href="/workspace?tab=deliver"
            className="group flex items-center gap-4 rounded-lg border border-line p-6 hover:border-accent/50 hover:bg-panel/30"
          >
            <div className="rounded-full bg-blue-500/20 p-3 group-hover:bg-blue-500/30">
              <FileText className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">从项目导入</h3>
              <p className="text-sm text-muted">基于EvoLab项目生成演示文稿</p>
            </div>
          </Link>
        </div>

        {/* Recent Documents */}
        {recentDocuments.length > 0 && (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted" />
              <h2 className="text-sm font-semibold text-white">最近编辑</h2>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recentDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    setActiveDocument(doc.id);
                    window.location.href = "/presentation-studio";
                  }}
                  className="group rounded-lg border border-line bg-panel/50 p-4 text-left hover:border-accent/50 hover:bg-panel"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-medium text-white group-hover:text-accent">{doc.title}</h3>
                    <span className={`rounded px-2 py-0.5 text-[10px] text-white ${
                      doc.status === "completed" ? "bg-green-500" :
                      doc.status === "in-progress" ? "bg-blue-500" :
                      "bg-gray-500"
                    }`}>
                      {doc.status === "completed" ? "已完成" :
                       doc.status === "in-progress" ? "进行中" :
                       "草稿"}
                    </span>
                  </div>

                  {doc.subtitle && (
                    <p className="mb-2 text-xs text-muted line-clamp-1">{doc.subtitle}</p>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{doc.outline.totalSlides} 张幻灯片</span>
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mt-12 rounded-lg border border-line bg-panel/30 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">功能特点</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <h4 className="mb-1 font-medium text-slate-200">AI生成大纲</h4>
              <p className="text-xs text-muted">输入主题，AI自动生成结构化大纲</p>
            </div>
            <div>
              <h4 className="mb-1 font-medium text-slate-200">逐页编辑</h4>
              <p className="text-xs text-muted">每张幻灯片独立生成和修改</p>
            </div>
            <div>
              <h4 className="mb-1 font-medium text-slate-200">AI辅助优化</h4>
              <p className="text-xs text-muted">自然语言指令修改内容</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
