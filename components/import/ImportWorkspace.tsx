"use client";

import { useImportStore } from "@/lib/store/import-slice";
import { ImportUploadPanel } from "./ImportUploadPanel";
import { ImportCalibratePanel } from "./ImportCalibratePanel";
import { ImportTracePanel } from "./ImportTracePanel";
import { ImportConvertPanel } from "./ImportConvertPanel";

export function ImportWorkspace() {
  const { currentStep, isProcessing, error, setError } = useImportStore();

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b bg-gray-50">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">导入与描摹</h1>
            <p className="text-sm text-gray-600 mt-1">
              从图片、PDF或DXF文件导入平面图
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <StepIndicator step={1} label="上传" active={currentStep === "upload"} completed={currentStep !== "upload"} />
              <div className="w-8 h-0.5 bg-gray-300" />
              <StepIndicator step={2} label="标定" active={currentStep === "calibrate"} completed={currentStep === "trace" || currentStep === "convert"} />
              <div className="w-8 h-0.5 bg-gray-300" />
              <StepIndicator step={3} label="描摹" active={currentStep === "trace"} completed={currentStep === "convert"} />
              <div className="w-8 h-0.5 bg-gray-300" />
              <StepIndicator step={4} label="转换" active={currentStep === "convert"} completed={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium whitespace-pre-wrap">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-700"
              aria-label="关闭错误提示"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
          <div className="flex items-center gap-2 text-blue-800">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium">处理中...</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {currentStep === "upload" && <ImportUploadPanel />}
        {currentStep === "calibrate" && <ImportCalibratePanel />}
        {currentStep === "trace" && <ImportTracePanel />}
        {currentStep === "convert" && <ImportConvertPanel />}
      </div>
    </div>
  );
}

function StepIndicator({ step, label, active, completed }: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          active
            ? "bg-blue-600 text-white"
            : completed
            ? "bg-green-600 text-white"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {completed ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          step
        )}
      </div>
      <span className={`text-xs ${active ? "font-medium text-gray-900" : "text-gray-600"}`}>
        {label}
      </span>
    </div>
  );
}
