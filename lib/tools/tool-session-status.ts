import type { ToolSessionStatus } from "@/lib/tools/tool-session-types";

export function formatToolSessionStatus(status: ToolSessionStatus): string {
  switch (status) {
    case "ready":
      return "可继续";
    case "promoted":
      return "已加入项目";
    default:
      return "草稿";
  }
}
