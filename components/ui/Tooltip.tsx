"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  className?: string;
  disabled?: boolean;
}

export function Tooltip({
  children,
  content,
  side = "top",
  align = "center",
  delayDuration = 200,
  className,
  disabled = false
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (disabled) return;
    const id = setTimeout(() => setIsVisible(true), delayDuration);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const positionClasses = {
    top: "-top-2 left-1/2 -translate-x-1/2 -translate-y-full",
    bottom: "-bottom-2 left-1/2 -translate-x-1/2 translate-y-full",
    left: "top-1/2 -left-2 -translate-y-1/2 -translate-x-full",
    right: "top-1/2 -right-2 -translate-y-1/2 translate-x-full"
  };

  const alignClasses = {
    start: side === "top" || side === "bottom" ? "left-0 translate-x-0" : "top-0 translate-y-0",
    center: "",
    end: side === "top" || side === "bottom" ? "left-auto right-0 translate-x-0" : "top-auto bottom-0 translate-y-0"
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && !disabled && (
        <div
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-md border border-line bg-[#1a1f2e] px-3 py-1.5 text-xs text-slate-200 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            positionClasses[side],
            align !== "center" && alignClasses[align],
            className
          )}
          role="tooltip"
        >
          {content}
          {/* Arrow */}
          <div
            className={cn(
              "absolute h-2 w-2 rotate-45 border-line bg-[#1a1f2e]",
              side === "top" && "bottom-[-5px] left-1/2 -translate-x-1/2 border-b border-r",
              side === "bottom" && "top-[-5px] left-1/2 -translate-x-1/2 border-l border-t",
              side === "left" && "right-[-5px] top-1/2 -translate-y-1/2 border-r border-t",
              side === "right" && "left-[-5px] top-1/2 -translate-y-1/2 border-b border-l"
            )}
          />
        </div>
      )}
    </div>
  );
}

// 简化版本：只需要title的快速tooltip
interface SimpleTooltipProps {
  title: string;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
}

export function SimpleTooltip({ title, children, side = "top", disabled = false }: SimpleTooltipProps) {
  return (
    <Tooltip content={title} side={side} disabled={disabled}>
      {children}
    </Tooltip>
  );
}
