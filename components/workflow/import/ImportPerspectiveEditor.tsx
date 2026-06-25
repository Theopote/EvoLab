"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultPerspectiveQuad,
  type ImagePoint,
  type PerspectiveQuad
} from "@/lib/import-image-utils";

interface ImageLayout {
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

interface ImportPerspectiveEditorProps {
  imageUrl: string;
  quad: PerspectiveQuad;
  onQuadChange: (quad: PerspectiveQuad) => void;
}

const cornerLabels = ["TL", "TR", "BR", "BL"];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function updateQuadCorner(quad: PerspectiveQuad, index: number, point: ImagePoint): PerspectiveQuad {
  const next = quad.map((entry, entryIndex) => (entryIndex === index ? point : entry)) as PerspectiveQuad;
  return next;
}

export function ImportPerspectiveEditor({ imageUrl, quad, onQuadChange }: ImportPerspectiveEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [layout, setLayout] = useState<ImageLayout | undefined>();
  const [activeCorner, setActiveCorner] = useState<number | undefined>();

  const measureLayout = useCallback(() => {
    const container = containerRef.current;
    const image = imageRef.current;

    if (!container || !image || !image.naturalWidth) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    setLayout({
      offsetX: imageRect.left - containerRect.left,
      offsetY: imageRect.top - containerRect.top,
      displayWidth: imageRect.width,
      displayHeight: imageRect.height
    });
  }, []);

  useEffect(() => {
    measureLayout();

    const container = containerRef.current;
    const image = imageRef.current;

    if (!container || !image) {
      return;
    }

    const observer = new ResizeObserver(() => measureLayout());
    observer.observe(container);
    observer.observe(image);

    return () => observer.disconnect();
  }, [imageUrl, measureLayout]);

  function normalizedToDisplay(point: ImagePoint) {
    if (!layout) {
      return point;
    }

    return [
      layout.offsetX + point[0] * layout.displayWidth,
      layout.offsetY + point[1] * layout.displayHeight
    ] as ImagePoint;
  }

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const quadRef = useRef(quad);
  quadRef.current = quad;
  const onQuadChangeRef = useRef(onQuadChange);
  onQuadChangeRef.current = onQuadChange;

  useEffect(() => {
    if (activeCorner === undefined) {
      return;
    }

    const cornerIndex = activeCorner;

    function onPointerMove(event: PointerEvent) {
      const container = containerRef.current;
      const currentLayout = layoutRef.current;

      if (!container || !currentLayout || currentLayout.displayWidth <= 0 || currentLayout.displayHeight <= 0) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const x = (event.clientX - containerRect.left - currentLayout.offsetX) / currentLayout.displayWidth;
      const y = (event.clientY - containerRect.top - currentLayout.offsetY) / currentLayout.displayHeight;
      const nextPoint: ImagePoint = [clamp(x, 0, 1), clamp(y, 0, 1)];
      onQuadChangeRef.current(updateQuadCorner(quadRef.current, cornerIndex, nextPoint));
    }

    function onPointerUp() {
      setActiveCorner(undefined);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [activeCorner]);

  const displayQuad = quad.map((point) => normalizedToDisplay(point));
  const polygonPoints = displayQuad.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div ref={containerRef} className="relative min-h-[360px] w-full">
      <img
        ref={imageRef}
        alt="Import perspective correction"
        className="mx-auto block max-h-[520px] max-w-full object-contain"
        src={imageUrl}
        onLoad={measureLayout}
      />

      {layout ? (
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <polygon
            fill="rgba(94,234,212,0.08)"
            points={polygonPoints}
            stroke="#5eead4"
            strokeDasharray="6 4"
            strokeWidth="2"
          />
          {displayQuad.map(([x, y], index) => (
            <g className="pointer-events-auto" key={cornerLabels[index]}>
              <circle
                className="pointer-events-auto cursor-grab"
                cx={x}
                cy={y}
                fill="#081018"
                r="12"
                stroke="#5eead4"
                strokeWidth="2"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setActiveCorner(index);
                }}
              />
              <text
                fill="#e2e8f0"
                fontSize="10"
                pointerEvents="none"
                textAnchor="middle"
                x={x}
                y={y + 3}
              >
                {cornerLabels[index]}
              </text>
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  );
}

export function createDefaultPerspectiveQuad() {
  return defaultPerspectiveQuad();
}
