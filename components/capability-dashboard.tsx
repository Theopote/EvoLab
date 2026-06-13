import { Activity, Box, DraftingCompass, Layers3, Ruler, Waypoints } from "lucide-react";
import type { PlanVersion, ProjectData } from "@/lib/project-types";

interface CapabilityDashboardProps {
  project: ProjectData;
  activeVersion?: PlanVersion;
}

const capabilities = [
  { label: "轮廓到平面", icon: DraftingCompass, status: "阶段 1 数据就绪" },
  { label: "语义模型", icon: Layers3, status: "ProjectData 驱动" },
  { label: "分析图层", icon: Waypoints, status: "待阶段 6 接入" },
  { label: "3D 模型", icon: Box, status: "待阶段 4 接入" },
  { label: "工程算量", icon: Ruler, status: "待阶段 7 接入" },
  { label: "方案评分", icon: Activity, status: "mock scores 可读" }
];

export function CapabilityDashboard({ project, activeVersion }: CapabilityDashboardProps) {
  return (
    <section className="cad-grid overflow-auto p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">EvoLab 建筑设计工作台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            阶段 1 已建立统一建筑语义数据模型。平面、模型、分析、系统与算量后续都将由同一份
            ProjectData 驱动。
          </p>
        </div>
        <div className="rounded border border-line bg-panel/80 px-4 py-3 text-right">
          <div className="text-xs text-muted">Active Version</div>
          <div className="mt-1 text-sm text-white">{activeVersion?.label ?? "无"}</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {capabilities.map((item) => {
          const Icon = item.icon;
          return (
            <article className="rounded border border-line bg-panel/80 p-4" key={item.label}>
              <div className="mb-3 flex items-center justify-between">
                <Icon className="h-5 w-5 text-accent" />
                <span className="rounded border border-line px-2 py-1 text-[11px] text-muted">
                  {item.status}
                </span>
              </div>
              <h2 className="text-sm font-medium text-white">{item.label}</h2>
            </article>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded border border-line bg-panel/90 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">当前方案空间数据</h2>
            <span className="text-xs text-muted">{project.versions.length} 个版本</span>
          </div>
          <div className="overflow-hidden rounded border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-3 py-2">房间</th>
                  <th className="px-3 py-2">类型</th>
                  <th className="px-3 py-2">分区</th>
                  <th className="px-3 py-2 text-right">面积</th>
                </tr>
              </thead>
              <tbody>
                {activeVersion?.rooms.map((room) => (
                  <tr className="border-t border-line/80" key={room.id}>
                    <td className="px-3 py-2 text-slate-100">{room.name}</td>
                    <td className="px-3 py-2 text-muted">{room.type}</td>
                    <td className="px-3 py-2 text-muted">{room.zone}</td>
                    <td className="px-3 py-2 text-right text-slate-100">{room.areaSqm} ㎡</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded border border-line bg-panel/90 p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">方案评分</h2>
          <div className="space-y-3">
            {[
              ["面积效率", activeVersion?.scores?.areaEfficiency],
              ["流线评分", activeVersion?.scores?.circulationScore],
              ["采光评分", activeVersion?.scores?.daylightScore],
              ["机电对齐", activeVersion?.scores?.mepAlignmentScore]
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-muted">{label}</span>
                  <span className="text-slate-200">{value ?? 0}</span>
                </div>
                <div className="h-1.5 rounded bg-white/[0.06]">
                  <div
                    className="h-1.5 rounded bg-accent"
                    style={{ width: `${Math.min(Number(value ?? 0), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
