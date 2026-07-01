export function WorkspacePanelFallback({ label = "加载面板…" }: { label?: string }) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded border border-line bg-panel/60 text-sm text-muted">
      {label}
    </div>
  );
}
