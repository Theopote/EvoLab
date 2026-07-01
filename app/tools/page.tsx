import dynamic from "next/dynamic";

const ToolsHome = dynamic(
  () => import("@/components/tools/ToolsHome").then((module) => ({ default: module.ToolsHome })),
  { loading: () => <div className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">加载工具箱…</div> }
);

export default function ToolsPage() {
  return <ToolsHome />;
}
