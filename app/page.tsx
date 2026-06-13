import { CapabilityDashboard } from "@/components/capability-dashboard";
import { TopNav } from "@/components/top-nav";
import { initialProjectData } from "@/lib/evolab-data";

export default function Home() {
  const activeVersion = initialProjectData.versions.find(
    (version) => version.id === initialProjectData.activeVersionId
  );

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-slate-100">
      <TopNav project={initialProjectData} />
      <section className="grid flex-1 grid-cols-[64px_minmax(0,1fr)_340px] overflow-hidden">
        <aside className="border-r border-line bg-[#0a0f15] p-3">
          <div className="flex h-full flex-col items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted">
            <div className="h-8 w-8 rounded border border-accent/50 bg-accent/10" />
            <span className="[writing-mode:vertical-rl]">Tools</span>
          </div>
        </aside>
        <CapabilityDashboard project={initialProjectData} activeVersion={activeVersion} />
        <aside className="border-l border-line bg-panel/90 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100">属性面板</h2>
            <span className="rounded border border-success/30 px-2 py-1 text-xs text-success">
              数据同步
            </span>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="rounded border border-line bg-white/[0.03] p-3">
              <dt className="text-xs text-muted">项目类型</dt>
              <dd className="mt-1 text-slate-100">{initialProjectData.projectType}</dd>
            </div>
            <div className="rounded border border-line bg-white/[0.03] p-3">
              <dt className="text-xs text-muted">当前方案</dt>
              <dd className="mt-1 text-slate-100">{activeVersion?.label ?? "未选择"}</dd>
            </div>
            <div className="rounded border border-line bg-white/[0.03] p-3">
              <dt className="text-xs text-muted">房间数量</dt>
              <dd className="mt-1 text-slate-100">{activeVersion?.rooms.length ?? 0}</dd>
            </div>
          </dl>
        </aside>
      </section>
    </main>
  );
}
