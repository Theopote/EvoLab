"use client";

import { useState, useRef } from "react";
import { useImportStore } from "@/lib/store/import-slice";
import type { CalibrateImportResponse, CalibrationPoint } from "@/lib/import-types";

export function ImportCalibratePanel() {
  const {
    session,
    calibrationPoints,
    calibrationUnit,
    addCalibrationPoint,
    removeCalibrationPoint,
    clearCalibrationPoints,
    setCalibrationUnit,
    setSession,
    setCurrentStep,
    setIsProcessing,
    setError
  } = useImportStore();

  const [imageLoaded, setImageLoaded] = useState(false);
  const [inputWorldCoord, setInputWorldCoord] = useState({ x: "", y: "" });
  const [pendingPixelCoord, setPendingPixelCoord] = useState<[number, number] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  if (!session?.source) return null;

  const handleImageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Store pixel coordinate and prompt for world coordinate
    setPendingPixelCoord([x, y]);
  };

  const handleAddPoint = () => {
    if (!pendingPixelCoord) return;
    if (!inputWorldCoord.x || !inputWorldCoord.y) {
      setError("请输入世界坐标");
      return;
    }

    const worldX = parseFloat(inputWorldCoord.x);
    const worldY = parseFloat(inputWorldCoord.y);

    if (isNaN(worldX) || isNaN(worldY)) {
      setError("坐标格式错误");
      return;
    }

    const point: CalibrationPoint = {
      pixel: pendingPixelCoord,
      world: [worldX, worldY],
      label: `点${calibrationPoints.length + 1}`
    };

    addCalibrationPoint(point);
    setPendingPixelCoord(null);
    setInputWorldCoord({ x: "", y: "" });
    setError(null);

    // Redraw canvas with new point
    redrawCanvas();
  };

  const handleCalculateCalibration = async () => {
    if (calibrationPoints.length < 2) {
      setError("至少需要2个标定点");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/import-calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          points: calibrationPoints,
          unit: calibrationUnit
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "标定计算失败");
      }

      const data: CalibrateImportResponse = await response.json();

      // Update session with calibration
      if (session) {
        setSession({
          ...session,
          calibration: data.calibration,
          status: "calibrating",
          updatedAt: new Date().toISOString()
        });
      }

      // Move to trace step
      setCurrentStep("trace");
    } catch (err) {
      setError(err instanceof Error ? err.message : "标定失败");
    } finally {
      setIsProcessing(false);
    }
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

    // Draw calibration points
    calibrationPoints.forEach((point, index) => {
      const [x, y] = point.pixel;

      // Draw point
      ctx.fillStyle = "#3B82F6";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw label
      ctx.fillStyle = "#1E40AF";
      ctx.font = "12px sans-serif";
      ctx.fillText(point.label || `${index + 1}`, x + 10, y - 10);
    });

    // Draw pending point
    if (pendingPixelCoord) {
      const [x, y] = pendingPixelCoord;
      ctx.strokeStyle = "#EF4444";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    redrawCanvas();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Canvas */}
      <div className="flex-1">
        <div className="border rounded-lg overflow-hidden bg-gray-50">
          <img
            ref={imageRef}
            src={`data:image/png;base64,${session.source.base64}`}
            alt="Import preview"
            className="hidden"
            onLoad={handleImageLoad}
          />
          <canvas
            ref={canvasRef}
            width={session.source.metadata?.width || 800}
            height={session.source.metadata?.height || 600}
            className="w-full cursor-crosshair"
            onClick={handleImageClick}
            role="img"
            aria-label="标定画布，点击选择标定点位置"
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          点击图片选择标定点，然后输入对应的世界坐标
        </p>
      </div>

      {/* Controls */}
      <div className="w-full lg:w-80 space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-4">标定设置</h3>

          <div className="space-y-4">
            <div>
              <label htmlFor="calibration-unit" className="block text-sm font-medium text-gray-700 mb-1">
                单位
              </label>
              <select
                id="calibration-unit"
                value={calibrationUnit}
                onChange={(e) => setCalibrationUnit(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="mm">毫米 (mm)</option>
                <option value="m">米 (m)</option>
                <option value="ft">英尺 (ft)</option>
                <option value="in">英寸 (in)</option>
              </select>
            </div>

            {pendingPixelCoord && (
              <div className="border-2 border-red-500 rounded-lg p-4 bg-red-50">
                <h4 className="font-medium text-red-900 mb-2">
                  输入世界坐标
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="world-x" className="block text-xs text-gray-700 mb-1">
                      X ({calibrationUnit})
                    </label>
                    <input
                      id="world-x"
                      type="number"
                      value={inputWorldCoord.x}
                      onChange={(e) => setInputWorldCoord({ ...inputWorldCoord, x: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="world-y" className="block text-xs text-gray-700 mb-1">
                      Y ({calibrationUnit})
                    </label>
                    <input
                      id="world-y"
                      type="number"
                      value={inputWorldCoord.y}
                      onChange={(e) => setInputWorldCoord({ ...inputWorldCoord, y: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddPoint}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    添加
                  </button>
                  <button
                    onClick={() => {
                      setPendingPixelCoord(null);
                      setInputWorldCoord({ x: "", y: "" });
                    }}
                    className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calibration points list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700">
              标定点 ({calibrationPoints.length})
            </h4>
            {calibrationPoints.length > 0 && (
              <button
                onClick={clearCalibrationPoints}
                className="text-xs text-red-600 hover:text-red-700"
              >
                清空
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {calibrationPoints.map((point, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                <div>
                  <div className="font-medium">{point.label}</div>
                  <div className="text-gray-600">
                    像素: ({point.pixel[0].toFixed(0)}, {point.pixel[1].toFixed(0)})
                  </div>
                  <div className="text-gray-600">
                    世界: ({point.world[0]}, {point.world[1]}) {calibrationUnit}
                  </div>
                </div>
                <button
                  onClick={() => removeCalibrationPoint(index)}
                  className="text-red-600 hover:text-red-700"
                  aria-label={`删除标定点 ${point.label}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {calibrationPoints.length < 2 && (
            <p className="text-xs text-gray-500 mt-2">
              至少需要2个标定点来计算比例和旋转
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={handleCalculateCalibration}
            disabled={calibrationPoints.length < 2}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            计算标定并继续
          </button>
          <button
            onClick={() => {
              setCurrentStep("trace");
            }}
            className="w-full px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            跳过标定
          </button>
        </div>
      </div>
    </div>
  );
}
