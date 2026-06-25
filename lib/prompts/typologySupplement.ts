import { getTopologyPromptContext } from "@/lib/typology/topology";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import { listFurniturePresets } from "@/lib/typologies/furniture";

export function buildTypologyPromptSupplement(projectType?: string): string {
  const pack = resolveTypologyPack(projectType);
  const furniture = listFurniturePresets(pack.id)
    .slice(0, 6)
    .map((item) => `- ${item.name} (${item.category}) for ${item.roomTypes.join(", ")}`)
    .join("\n");

  return [
    getTopologyPromptContext(pack),
    "",
    "Copilot language:",
    `- Use ${pack.label.toLowerCase()} terminology in labels, rationales, and report copy.`,
    `- Prefer room names from the ${pack.label.toLowerCase()} program template.`,
    "",
    "Suggested furniture library:",
    furniture || "- Use typology-appropriate furniture only when requested."
  ].join("\n");
}
