"use client";

import { Plus, Trash2 } from "lucide-react";
import { useProjectActions, useProjectState } from "@/lib/project-store";
import type { ProjectIntakeRecord } from "@/lib/intake/project-intake-types";

type IntakeListField = "constraints" | "risks" | "opportunities" | "openQuestions";

const listSections: Array<{ field: IntakeListField; title: string; placeholder: string }> = [
  { field: "constraints", title: "限制条件", placeholder: "退线、限高、产权边界…" },
  { field: "risks", title: "风险", placeholder: "日照、消防、管线冲突…" },
  { field: "opportunities", title: "设计机会", placeholder: "景观面、公共性、灵活性…" },
  { field: "openQuestions", title: "待确认问题", placeholder: "需甲方/顾问确认的事项…" }
];

export function ProjectIntakePanel() {
  const intake = useProjectState((state) => state.project.domain.intake);
  const { updateProjectIntake } = useProjectActions();
  const record = intake ?? {
    summary: "",
    constraints: [],
    risks: [],
    opportunities: [],
    openQuestions: []
  };

  function updateList(field: IntakeListField, index: number, value: string) {
    const next = [...record[field]];
    next[index] = value;
    updateProjectIntake({ [field]: next });
  }

  function addListItem(field: IntakeListField) {
    updateProjectIntake({ [field]: [...record[field], ""] });
  }

  function removeListItem(field: IntakeListField, index: number) {
    updateProjectIntake({ [field]: record[field].filter((_, itemIndex) => itemIndex !== index) });
  }

  return (
    <section className="rounded border border-line bg-panel/90 p-4">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-white">项目资料库</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          整理前期资料摘要、限制、风险与设计机会，作为任务书与方案生成的输入底座。
        </p>
      </header>

      <label className="block space-y-2">
        <span className="text-xs font-medium text-slate-200">资料摘要</span>
        <textarea
          className="min-h-24 w-full rounded border border-line bg-[#0b1118] px-3 py-2 text-sm text-slate-100 outline-none focus:border-accent/50"
          placeholder="项目背景、现状、关键诉求…"
          value={record.summary}
          onChange={(event) => updateProjectIntake({ summary: event.target.value })}
        />
      </label>

      <div className="mt-4 space-y-4">
        {listSections.map((section) => (
          <IntakeListSection
            items={record[section.field]}
            key={section.field}
            placeholder={section.placeholder}
            title={section.title}
            onAdd={() => addListItem(section.field)}
            onChange={(index, value) => updateList(section.field, index, value)}
            onRemove={(index) => removeListItem(section.field, index)}
          />
        ))}
      </div>
    </section>
  );
}

function IntakeListSection({
  title,
  placeholder,
  items,
  onAdd,
  onChange,
  onRemove
}: {
  title: string;
  placeholder: string;
  items: ProjectIntakeRecord["constraints"];
  onAdd: () => void;
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{title}</h3>
        <button
          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
          type="button"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3" />
          添加
        </button>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="rounded border border-dashed border-line px-3 py-2 text-xs text-muted">暂无条目</p>
        ) : null}
        {items.map((item, index) => (
          <div className="flex items-center gap-2" key={`${title}-${index}`}>
            <input
              className="h-9 flex-1 rounded border border-line bg-[#0b1118] px-3 text-sm text-slate-100 outline-none focus:border-accent/50"
              placeholder={placeholder}
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
            />
            <button
              className="grid h-9 w-9 place-items-center rounded border border-line text-muted hover:border-danger/50 hover:text-danger"
              type="button"
              aria-label="删除"
              onClick={() => onRemove(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
