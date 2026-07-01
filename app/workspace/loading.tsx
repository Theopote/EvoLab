export default function WorkspaceLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas text-slate-300">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted">正在加载工作台…</p>
      </div>
    </div>
  );
}
