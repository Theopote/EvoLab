"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ComplianceItem } from "@/lib/quantity-engine";

interface ComplianceChecklistProps {
  items: ComplianceItem[];
}

export function ComplianceChecklist({ items }: ComplianceChecklistProps) {
  const warningCount = items.filter((item) => item.status === "warning").length;

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Compliance Checks</h2>
          <p className="mt-1 text-xs text-muted">Early-stage rule checks from activeVersion data.</p>
        </div>
        <span
          className={`rounded border px-2 py-1 text-xs ${
            warningCount > 0 ? "border-warning/40 text-warning" : "border-success/40 text-success"
          }`}
        >
          {warningCount} warnings
        </span>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.status === "warning" ? AlertTriangle : CheckCircle2;
          const tone = item.status === "warning" ? "text-warning" : "text-success";

          return (
            <article className="rounded border border-line bg-[#0b1118] p-3" key={item.id}>
              <div className="flex gap-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-slate-100">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{item.message}</p>
                  <p className="mt-2 text-[11px] leading-4 text-muted">{item.basis}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
