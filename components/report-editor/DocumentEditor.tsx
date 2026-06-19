"use client";

import type { ReportBlock, ReportSection } from "@/lib/report-types";

interface DocumentEditorProps {
  sections: ReportSection[];
  selectedBlockId?: string;
  onSelectBlock: (sectionId: string, blockId: string) => void;
  onBlockChange: (sectionId: string, blockId: string, nextBlock: ReportBlock) => void;
}

export function DocumentEditor({
  sections,
  selectedBlockId,
  onSelectBlock,
  onBlockChange
}: DocumentEditorProps) {
  return (
    <div className="space-y-6 overflow-auto pr-2">
      {sections.map((section) => (
        <section className="rounded border border-line bg-panel/70 p-4" key={section.id}>
          <h2 className="mb-3 text-lg font-semibold text-white">{section.title}</h2>
          <div className="space-y-3">
            {section.blocks.map((block) => (
              <BlockEditor
                block={block}
                key={block.id}
                selected={selectedBlockId === block.id}
                onChange={(nextBlock) => onBlockChange(section.id, block.id, nextBlock)}
                onSelect={() => onSelectBlock(section.id, block.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockEditor({
  block,
  selected,
  onSelect,
  onChange
}: {
  block: ReportBlock;
  selected: boolean;
  onSelect: () => void;
  onChange: (block: ReportBlock) => void;
}) {
  if (block.type === "image_ref") {
    return (
      <div
        className={`rounded border border-dashed p-6 text-center text-sm text-muted ${
          selected ? "border-accent/60" : "border-line"
        }`}
        onClick={onSelect}
      >
        Live plan reference — {block.imageRef?.caption ?? "Floor plan"}
      </div>
    );
  }

  if (block.type === "table" && block.table) {
    return (
      <div className={`overflow-hidden rounded border ${selected ? "border-accent/60" : "border-line"}`} onClick={onSelect}>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04]">
            <tr>
              {block.table.headers.map((header) => (
                <th className="px-3 py-2 text-left text-muted" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, rowIndex) => (
              <tr className="border-t border-line" key={`${block.id}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td className="px-3 py-2" key={`${block.id}-cell-${rowIndex}-${cellIndex}`}>
                    <input
                      className="w-full bg-transparent text-slate-100 outline-none"
                      value={cell}
                      onChange={(event) => {
                        const rows = block.table!.rows.map((existing, index) =>
                          index === rowIndex
                            ? existing.map((value, columnIndex) =>
                                columnIndex === cellIndex ? event.target.value : value
                              )
                            : existing
                        );
                        onChange({ ...block, table: { ...block.table!, rows } });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "bullet_list") {
    return (
      <textarea
        className={`min-h-[96px] w-full rounded border bg-[#0b1118] p-3 text-sm text-slate-100 outline-none ${
          selected ? "border-accent/60" : "border-line"
        }`}
        value={(block.bullets ?? []).join("\n")}
        onFocus={onSelect}
        onChange={(event) =>
          onChange({
            ...block,
            bullets: event.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
          })
        }
      />
    );
  }

  return (
    <div
      className={`rounded border bg-[#0b1118] p-3 text-sm leading-6 text-slate-100 ${
        selected ? "border-accent/60" : "border-line"
      }`}
      contentEditable
      suppressContentEditableWarning
      onFocus={onSelect}
      onBlur={(event) => onChange({ ...block, content: event.currentTarget.textContent ?? "" })}
    >
      {block.content}
    </div>
  );
}
