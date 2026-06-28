"use client";

import { useState, useRef, useEffect } from "react";
import { useImportStore } from "@/lib/store/import-slice";
import type { TraceImportResponse, TracedElement } from "@/lib/import-types";

export function ImportTracePanel() {
  const {
    session,
    traceMode,
    manualElements,
    setTraceMode,
    addManualElement,
    removeManualElement,
    clearManualElements,
    setSession,
    setCurrentStep,
    setIsProcessing,
    setError
  } = useImportStore();

  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElementType, setCurrentElementType] = useState<"wall" | "room">("wall");
  const [aiTraceResult, setAiTraceResult] = useState<TracedElement[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    redrawCanvas();
  }, [manualElements, drawingPoints, aiTraceResult]);

  if (!session?.source) return null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (traceMode !== "manual") return;

    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawingPoints([...drawingPoints, [x, y]]);
  };

  const handleFinishDrawing = () => {
    if (drawingPoints.length < 2) return;

    const element = {
      id: `manual_${Date.now()}`,
      points: drawingPoints,
      type: currentElementType
    };

    addManualElement(element);
    setDrawingPoints([]);
  };

  const handleCancelDrawing = () => {
    setDrawingPoints([]);
  };

  const handleAITrace = async () => {
    if (!session) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/import-trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          mode: "ai",
          hints: {
            includeOpenings: true
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "AI描摹失败");
      }

      const data: TraceImportResponse = await response.json();

      setAiTraceResult(data.trace.elements);

      // Update session with trace
      setSession({
        ...session,
        trace: data.trace,
        status: "tracing",
        updatedAt: new Date().toISOString()
      });

      if (data.warnings && data.warnings.length > 0) {
        setError(data.warnings.join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI描摹失败");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConvertToProject = () => {
    setCurrentStep("convert");
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and redraw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw manual elements
    manualElements.forEach((element) => {
      ctx.strokeStyle = element.type === "wall" ? "#3B82F6" : "#10B981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      element.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
      ctx.stroke();

      // Draw points
      element.points.forEach((point) => {
        ctx.fillStyle = element.type === "wall" ? "#3B82F6" : "#10B981";
        ctx.beginPath();
        ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    });

    // Draw AI trace results
    aiTraceResult.forEach((element) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Convert normalized coordinates to canvas coordinates
      const points = element.points.map(([x, y]) => [
        x * canvas.width,
        y * canvas.height
      ] as [number, number]);

      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
      if (element.closed) {
        ctx.closePath();
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw label
      if (element.label && points.length > 0) {
        const [x, y] = points[0];
        ctx.fillStyle = "#EF4444";
        ctx.font = "12px sans-serif";
        ctx.fillText(element.label, x + 5, y - 5);
      }
    });

    // Draw current drawing
    if (drawingPoints.length > 0) {
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 2;
      ctx.beginPath();
      drawingPoints.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
      ctx.stroke();

      // Draw points
      drawingPoints.forEach((point) => {
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.arc(point[0], point[1], 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Canvas */}
      <div className="flex-1">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <img
            ref={imageRef}
            src={`data:image/png;base64,${session.source.base64}`}
            alt="Trace preview"
            className="hidden"
            onLoad={() => redrawCanvas()}
          />
          <canvas
            ref={canvasRef}
            width={session.source.metadata?.width || 800}
            height={session.source.metadata?.height || 600}
            className="w-full cursor-crosshair"
            onClick={handleCanvasClick}
            role="img"
            aria-label={`描摹画布，当前模式：${traceMode === "manual" ? "手动" : "AI"}`}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
          <p>
            {traceMode === "manual"
              ? "点击画布添加点，完成后点击"完成绘制""
              : "使用AI自动识别墙体和房间"}
          </p>
          {drawingPoints.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleFinishDrawing}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                完成绘制
              </button>
              <button
                onClick={handleCancelDrawing}
                className="px-3 py-1 border rounded text-xs hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80 space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">描摹模式</h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="trace-mode"
                value="manual"
                checked={traceMode === "manual"}
                onChange={(e) => setTraceMode(e.target.value as any)}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">手动描摹</div>
                <div className="text-xs text-gray-600">手动绘制墙体和房间</div>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="trace-mode"
                value="ai"
                checked={traceMode === "ai"}
                onChange={(e) => setTraceMode(e.target.value as any)}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">AI辅助</div>
                <div className="text-xs text-gray-600">自动识别建筑元素</div>
              </div>
            </label>
          </div>
        </div>

        {traceMode === "manual" && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">绘制类型</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentElementType("wall")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                  currentElementType === "wall"
                    ? "bg-blue-600 text-white"
                    : "border hover:bg-gray-50"
                }`}
              >
                墙体
              </button>
              <button
                onClick={() => setCurrentElementType("room")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm ${
                  currentElementType === "room"
                    ? "bg-green-600 text-white"
                    : "border hover:bg-gray-50"
                }`}
              >
                房间
              </button>
            </div>
          </div>
        )}

        {traceMode === "ai" && (
          <div>
            <button
              onClick={handleAITrace}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              开始AI识别
            </button>
            <p className="text-xs text-gray-500 mt-2">
              AI将自动检测图中的建筑元素
            </p>
          </div>
        )}

        {/* Elements list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              已绘制元素 ({manualElements.length + aiTraceResult.length})
            </h4>
            {manualElements.length > 0 && (
              <button
                onClick={clearManualElements}
                className="text-xs text-red-600 hover:text-red-700"
              >
                清空手动
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {manualElements.map((element) => (
              <div key={element.id} className="flex items-center justify-between p-2 bg-blue-50 rounded text-xs">
                <div>
                  <div className="font-medium">{element.type === "wall" ? "墙体" : "房间"}</div>
                  <div className="text-gray-600">{element.points.length} 个点</div>
                </div>
                <button
                  onClick={() => removeManualElement(element.id)}
                  className="text-red-600 hover:text-red-700"
                  aria-label={`删除元素 ${element.id}`}
                >
                  ✕
                </button>
              </div>
            ))}

            {aiTraceResult.map((element) => (
              <div key={element.id} className="flex items-center justify-between p-2 bg-red-50 rounded text-xs">
                <div>
                  <div className="font-medium">{element.label || element.type}</div>
                  <div className="text-gray-600">
                    AI识别 {element.confidence ? `(${(element.confidence * 100).toFixed(0)}%)` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleConvertToProject}
            disabled={manualElements.length === 0 && aiTraceResult.length === 0}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            转换为项目
          </button>
          <button
            onClick={() => setCurrentStep("calibrate")}
            className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            返回标定
          </button>
        </div>
      </div>
    </div>
  );
}
