"use client";

import { useState } from "react";
import { useImportStore } from "@/lib/store/import-slice";
import type { ImportSourceType, UploadImportResponse } from "@/lib/import-types";

export function ImportUploadPanel() {
  const { setSession, setCurrentStep, setIsProcessing, setError } = useImportStore();
  const [dragActive, setDragActive] = useState(false);

  const handleFileUpload = async (file: File, sourceType: ImportSourceType) => {
    setIsProcessing(true);
    setError(null);

    try {
      // Convert file to base64
      const base64 = await fileToBase64(file);

      const response = await fetch("/api/import-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: base64,
          fileName: file.name,
          sourceType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "上传失败");
      }

      const data: UploadImportResponse = await response.json();

      // Create session
      setSession({
        id: data.sessionId,
        source: data.source,
        status: "uploaded",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Move to calibration step
      setCurrentStep("calibrate");
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const sourceType = detectSourceType(file.name);
    if (!sourceType) {
      setError("不支持的文件类型。请上传图片、PDF或DXF文件。");
      return;
    }

    await handleFileUpload(file, sourceType);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sourceType = detectSourceType(file.name);
    if (!sourceType) {
      setError("不支持的文件类型");
      return;
    }

    await handleFileUpload(file, sourceType);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div
        className={`w-full max-w-xl border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-blue-600 hover:text-blue-700 font-medium">
              选择文件
            </span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept=".png,.jpg,.jpeg,.pdf,.dxf"
              onChange={handleFileInput}
            />
          </label>
          <span className="text-gray-600"> 或拖拽到此处</span>
        </div>

        <p className="mt-2 text-sm text-gray-500">
          支持 PNG、JPEG、PDF、DXF 格式
        </p>
      </div>

      <div className="mt-8 w-full max-w-xl space-y-4">
        <h3 className="text-sm font-medium text-gray-700">导入方式：</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900">图片导入</h4>
            <p className="text-sm text-gray-600 mt-1">
              扫描图纸、照片、手绘草图
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900">PDF导入</h4>
            <p className="text-sm text-gray-600 mt-1">
              多页PDF，可选择特定页面
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <h4 className="font-medium text-gray-900">DXF导入</h4>
            <p className="text-sm text-gray-600 mt-1">
              CAD文件轮廓与线段
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function detectSourceType(fileName: string): ImportSourceType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "png" || ext === "jpg" || ext === "jpeg") return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "dxf") return "dxf";
  return null;
}
