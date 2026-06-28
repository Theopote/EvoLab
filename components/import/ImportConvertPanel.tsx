"use client";

import { useState } from "react";
import { useImportStore } from "@/lib/store/import-slice";
import type { ConvertToProjectResponse } from "@/lib/import-types";

export function ImportConvertPanel() {
  const { session, setIsProcessing, setError } = useImportStore();
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("healthcare");
  const [applyTrace, setApplyTrace] = useState(true);
  const [convertResult, setConvertResult] = useState<ConvertToProjectResponse | null>(null);

  if (!session) return null;

  const handleConvert = async () => {
    if (!projectName.trim()) {
      setError("请输入项目名称");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/import-convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          projectName: projectName.trim(),
          projectType,
          applyTrace
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "转换失败");
      }

      const data: ConvertToProjectResponse = await response.json();
      setConvertResult(data);

      // Here you would typically redirect to the main editor with the new project
      // For now, just show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : "转换失败");
    } finally {
      setIsProcessing(false);
    }
  };

  if (convertResult) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <div className="max-w-lg text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-medium">转换成功！</h3>
          <p className="text-gray-600">
            已创建项目轮廓，包含 {convertResult.rooms?.length || 0} 个房间
          </p>
          <div className="space-y-2 pt-4">
            <button
              onClick={() => {
                // Navigate to editor with new project
                window.location.href = "/editor";
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              进入编辑器
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 border rounded-lg hover:bg-gray-50"
            >
              导入新图纸
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="w-full max-w-lg space-y-6">
        <h3 className="text-xl font-medium text-center">创建项目</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 mb-1">
              项目名称
            </label>
            <input
              id="project-name"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="输入项目名称"
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label htmlFor="project-type" className="block text-sm font-medium text-gray-700 mb-1">
              项目类型
            </label>
            <select
              id="project-type"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="healthcare">医疗建筑</option>
              <option value="office">办公建筑</option>
              <option value="residential">住宅建筑</option>
              <option value="education">教育建筑</option>
              <option value="mixed">综合建筑</option>
            </select>
          </div>

          <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={applyTrace}
              onChange={(e) => setApplyTrace(e.target.checked)}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">应用描摹结果</div>
              <div className="text-sm text-gray-600">
                {session.trace
                  ? `使用已识别的 ${session.trace.elements.length} 个元素`
                  : "从空白轮廓开始"}
              </div>
            </div>
          </label>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">导入信息</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>来源: {session.source.fileName}</div>
            {session.calibration && (
              <div>
                标定: 比例 {session.calibration.scale.toFixed(2)},
                旋转 {session.calibration.rotation.toFixed(1)}°
              </div>
            )}
            {session.trace && (
              <div>描摹: {session.trace.elements.length} 个元素</div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleConvert}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            创建项目
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 border rounded-lg hover:bg-gray-50"
          >
            取消并重新开始
          </button>
        </div>
      </div>
    </div>
  );
}
