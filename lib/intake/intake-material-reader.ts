import type { IntakeMaterialInput } from "@/lib/intake/mock-intake-synthesis";
import type { IntakeSourceFile } from "@/lib/intake/project-intake-types";

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsText(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function detectKind(file: File): IntakeSourceFile["kind"] {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") {
    return "pdf";
  }

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return "image";
  }

  return "text";
}

export async function readIntakeMaterial(file: File): Promise<{
  metadata: IntakeSourceFile;
  material: IntakeMaterialInput;
}> {
  const kind = detectKind(file);
  const id = `intake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const addedAt = new Date().toISOString();

  if (kind === "text") {
    const content = await readFileAsText(file);
    return {
      metadata: {
        id,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        kind,
        addedAt,
        excerpt: content.slice(0, 240)
      },
      material: {
        fileName: file.name,
        kind: "text",
        content
      }
    };
  }

  const base64 = await readFileAsBase64(file);

  return {
    metadata: {
      id,
      fileName: file.name,
      mimeType: file.type || (kind === "pdf" ? "application/pdf" : "image/*"),
      kind,
      addedAt,
      excerpt: kind === "pdf" ? "PDF 资料（合成时将走 Mock/AI 解析）" : "图像资料（合成时将走 Mock/AI 解析）"
    },
    material: {
      fileName: file.name,
      kind,
      base64,
      content: `[${kind.toUpperCase()} attachment: ${file.name}]`
    }
  };
}
