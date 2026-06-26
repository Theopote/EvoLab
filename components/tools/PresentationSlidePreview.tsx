"use client";

import type { PresentationSlide } from "@/lib/presentation/types";

interface PresentationSlidePreviewProps {
  slide: PresentationSlide;
  className?: string;
}

export function PresentationSlidePreview({ slide, className }: PresentationSlidePreviewProps) {
  return (
    <div className={`overflow-hidden rounded border border-line bg-[#081018] p-4 ${className ?? ""}`}>
      <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-muted">{slide.kind}</div>
      <h3 className="text-base font-semibold text-white">{slide.title}</h3>
      {slide.subtitle ? <p className="mt-1 text-sm text-muted">{slide.subtitle}</p> : null}
      <ul className="mt-3 space-y-1.5 text-xs text-slate-200">
        {slide.bullets.map((bullet, index) => (
          <li className="leading-5" key={index}>
            {bullet}
          </li>
        ))}
      </ul>
      {slide.svg ? (
        <div
          className="mt-4 overflow-hidden rounded border border-line/60 bg-[#0b1118] p-2 [&_svg]:h-auto [&_svg]:max-h-48 [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: slide.svg }}
        />
      ) : null}
      {slide.table ? (
        <div className="mt-4 overflow-auto rounded border border-line/60">
          <table className="w-full text-left text-[11px] text-slate-200">
            <thead className="bg-panel/80 text-muted">
              <tr>
                {slide.table.headers.map((header) => (
                  <th className="px-2 py-1.5 font-medium" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.table.rows.map((row, rowIndex) => (
                <tr className="border-t border-line/40" key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td className="px-2 py-1.5" key={cellIndex}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
