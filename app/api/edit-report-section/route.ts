import { requestAnthropicText } from "@/lib/anthropic-json";
import { enforceSectionScope, detectSectionScopeViolations } from "@/lib/report-section-scope";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { ReportBlock, ReportSection } from "@/lib/report-types";

interface EditReportSectionRequest {
  section?: ReportSection;
  blockId?: string;
  instruction?: string;
  allSections?: ReportSection[];
}

function blockText(block: ReportBlock | undefined) {
  if (!block) {
    return "";
  }

  if (block.type === "paragraph") {
    return block.content ?? "";
  }

  if (block.type === "bullet_list") {
    return (block.bullets ?? []).join("\n");
  }

  if (block.type === "table") {
    const headers = block.table?.headers.join(" | ") ?? "";
    const rows = (block.table?.rows ?? []).map((row) => row.join(" | ")).join("\n");
    return `${headers}\n${rows}`;
  }

  return block.imageRef?.caption ?? "";
}

function applyTextToBlock(block: ReportBlock, nextText: string): ReportBlock {
  if (block.type === "paragraph") {
    return { ...block, content: nextText };
  }

  if (block.type === "bullet_list") {
    return {
      ...block,
      bullets: nextText
        .split("\n")
        .map((line) => line.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
    };
  }

  return block;
}

function mockRewrite(currentText: string, instruction: string, grounding: ReportSection["grounding"]) {
  const factLine = Object.entries(grounding.facts)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("; ");

  if (/通俗|plain|simpl/i.test(instruction)) {
    return `${currentText}\n\n(Plain-language emphasis grounded in ${factLine})`;
  }

  if (/正式|formal/i.test(instruction)) {
    return `This section summarizes verified project metrics (${factLine}). ${currentText}`;
  }

  if (/强调|emphas/i.test(instruction)) {
    return `${currentText} Key verified facts: ${factLine}.`;
  }

  return `${currentText} [Revised per instruction: ${instruction}. Grounded in ${factLine}]`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as EditReportSectionRequest;

  if (!body.section || !body.blockId || !body.instruction?.trim() || !body.allSections?.length) {
    return apiError("section, blockId, instruction, and allSections are required.", 400, "INVALID_PAYLOAD");
  }

  const targetBlock = body.section.blocks.find((block) => block.id === body.blockId);

  if (!targetBlock || targetBlock.type === "image_ref") {
    return apiError("Editable text block not found in section.", 400, "INVALID_PAYLOAD");
  }

  const currentText = blockText(targetBlock);
  const groundingContext = body.section.grounding;

  const prompt = `You are editing one section of an architectural design report.

【Original facts — you MUST stay within these facts. Do NOT invent new project data.】
${JSON.stringify(groundingContext)}

【Current text】
${currentText}

【Edit instruction】
"${body.instruction}"

"Emphasize" means highlight existing facts, not invent sustainability features or systems absent from the facts.
Return only the revised text for this block.`;

  let revisedText = currentText;

  try {
    revisedText = await requestAnthropicText({
      system:
        "Rewrite architectural report copy using only provided grounding facts. Never add facts not present in groundingContext.",
      prompt,
      maxTokens: 1200
    });
  } catch {
    revisedText = mockRewrite(currentText, body.instruction, groundingContext);
  }

  const aiSection: ReportSection = {
    ...body.section,
    blocks: body.section.blocks.map((block) =>
      block.id === body.blockId ? applyTextToBlock(block, revisedText.trim()) : block
    )
  };

  const aiModified = body.allSections.map((section) => (section.id === aiSection.id ? aiSection : section));
  const violations = detectSectionScopeViolations(body.allSections, aiModified, body.section.id);
  const sections = enforceSectionScope(body.allSections, aiModified, body.section.id);
  const nextSection = sections.find((section) => section.id === body.section!.id);

  return apiOk({
    sections,
    section: nextSection,
    scopeViolations: violations,
    rejectedOutOfScope: violations.length > 0
  });
}
