import type { PresentationTemplateId } from "@/lib/presentation/types";

export interface PresentationTemplate {
  id: PresentationTemplateId;
  label: string;
  description: string;
  html: {
    bodyBackground: string;
    slideBackground: string;
    slideBorder: string;
    accent: string;
    heading: string;
    subheading: string;
    text: string;
    meta: string;
  };
  pptx: {
    titleBackground: string;
    titleText: string;
    titleMuted: string;
    contentBackground: string;
    heading: string;
    subheading: string;
    body: string;
    muted: string;
  };
}

export const presentationTemplates: Record<PresentationTemplateId, PresentationTemplate> = {
  classic: {
    id: "classic",
    label: "Classic Board",
    description: "Light editorial layout for client PDF packs.",
    html: {
      bodyBackground: "#f4f7fb",
      slideBackground: "#ffffff",
      slideBorder: "#dbe4ee",
      accent: "#0f766e",
      heading: "#0f172a",
      subheading: "#475569",
      text: "#334155",
      meta: "#64748b"
    },
    pptx: {
      titleBackground: "0F172A",
      titleText: "F8FAFC",
      titleMuted: "94A3B8",
      contentBackground: "FFFFFF",
      heading: "0F172A",
      subheading: "475569",
      body: "334155",
      muted: "64748B"
    }
  },
  studio: {
    id: "studio",
    label: "Studio Dark",
    description: "High-contrast dark slides for screen presentations.",
    html: {
      bodyBackground: "#0b1118",
      slideBackground: "#111827",
      slideBorder: "#1f2937",
      accent: "#4fb5c8",
      heading: "#f8fafc",
      subheading: "#94a3b8",
      text: "#cbd5e1",
      meta: "#64748b"
    },
    pptx: {
      titleBackground: "081018",
      titleText: "F8FAFC",
      titleMuted: "4FB5C8",
      contentBackground: "111827",
      heading: "F8FAFC",
      subheading: "94A3B8",
      body: "CBD5E1",
      muted: "64748B"
    }
  }
};

export function resolvePresentationTemplate(templateId?: PresentationTemplateId) {
  return presentationTemplates[templateId ?? "classic"];
}
