/**
 * Presentation Studio State Management
 * Zustand store for managing presentation documents and editing state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PresentationDocument,
  StudioSlide,
  PresentationOutline,
  SlideStatus
} from "@/lib/presentation-studio/types";

interface PresentationStudioState {
  // 当前打开的演示文稿列表
  documents: PresentationDocument[];

  // 当前活动的文档ID
  activeDocumentId: string | null;

  // 当前选中的幻灯片ID
  activeSlideId: string | null;

  // UI状态
  viewMode: "outline" | "slide-editor" | "preview";
  sidebarOpen: boolean;
  isGenerating: boolean;
  generatingSlideIds: Set<string>;

  // Actions - 文档管理
  createDocument: (title: string, projectId?: string) => PresentationDocument;
  deleteDocument: (id: string) => void;
  setActiveDocument: (id: string | null) => void;
  updateDocument: (id: string, updates: Partial<PresentationDocument>) => void;

  // Actions - 大纲管理
  setOutline: (documentId: string, outline: PresentationOutline) => void;
  reorderSlides: (documentId: string, slideIds: string[]) => void;

  // Actions - 幻灯片管理
  addSlide: (documentId: string, slide: StudioSlide, position?: number) => void;
  updateSlide: (documentId: string, slideId: string, updates: Partial<StudioSlide>) => void;
  deleteSlide: (documentId: string, slideId: string) => void;
  duplicateSlide: (documentId: string, slideId: string) => void;
  setActiveSlide: (slideId: string | null) => void;

  // Actions - 批量操作
  batchUpdateSlides: (documentId: string, updates: Array<{ slideId: string; updates: Partial<StudioSlide> }>) => void;
  setSlideStatus: (documentId: string, slideId: string, status: SlideStatus) => void;

  // Actions - UI状态
  setViewMode: (mode: PresentationStudioState["viewMode"]) => void;
  setSidebarOpen: (open: boolean) => void;
  setGenerating: (generating: boolean, slideIds?: string[]) => void;

  // Getters
  getActiveDocument: () => PresentationDocument | null;
  getActiveSlide: () => StudioSlide | null;
  getSlideById: (documentId: string, slideId: string) => StudioSlide | null;
  getDocumentById: (id: string) => PresentationDocument | null;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const usePresentationStudio = create<PresentationStudioState>()(
  persist(
    (set, get) => ({
      // Initial state
      documents: [],
      activeDocumentId: null,
      activeSlideId: null,
      viewMode: "outline",
      sidebarOpen: true,
      isGenerating: false,
      generatingSlideIds: new Set(),

      // Document management
      createDocument: (title, projectId) => {
        const now = new Date().toISOString();
        const newDoc: PresentationDocument = {
          id: generateId(),
          title,
          projectId,
          outline: {
            title,
            sections: [],
            totalSlides: 0
          },
          slides: [],
          theme: "modern",
          aspectRatio: "16:9",
          createdAt: now,
          updatedAt: now,
          status: "draft"
        };

        set((state) => ({
          documents: [...state.documents, newDoc],
          activeDocumentId: newDoc.id
        }));

        return newDoc;
      },

      deleteDocument: (id) => {
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
          activeDocumentId: state.activeDocumentId === id ? null : state.activeDocumentId
        }));
      },

      setActiveDocument: (id) => {
        set({ activeDocumentId: id, activeSlideId: null });
      },

      updateDocument: (id, updates) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id
              ? { ...doc, ...updates, updatedAt: new Date().toISOString() }
              : doc
          )
        }));
      },

      // Outline management
      setOutline: (documentId, outline) => {
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === documentId
              ? { ...doc, outline, updatedAt: new Date().toISOString() }
              : doc
          )
        }));
      },

      reorderSlides: (documentId, slideIds) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            const slideMap = new Map(doc.slides.map((s) => [s.id, s]));
            const reorderedSlides = slideIds
              .map((id, index) => {
                const slide = slideMap.get(id);
                return slide ? { ...slide, order: index } : null;
              })
              .filter((s): s is StudioSlide => s !== null);

            return { ...doc, slides: reorderedSlides, updatedAt: new Date().toISOString() };
          })
        }));
      },

      // Slide management
      addSlide: (documentId, slide, position) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            const slides = [...doc.slides];
            const insertPos = position ?? slides.length;
            slides.splice(insertPos, 0, slide);

            // Update order
            const reorderedSlides = slides.map((s, idx) => ({ ...s, order: idx }));

            return {
              ...doc,
              slides: reorderedSlides,
              updatedAt: new Date().toISOString()
            };
          })
        }));
      },

      updateSlide: (documentId, slideId, updates) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            return {
              ...doc,
              slides: doc.slides.map((slide) =>
                slide.id === slideId
                  ? { ...slide, ...updates, lastEditedAt: new Date().toISOString() }
                  : slide
              ),
              updatedAt: new Date().toISOString()
            };
          })
        }));
      },

      deleteSlide: (documentId, slideId) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            const slides = doc.slides
              .filter((s) => s.id !== slideId)
              .map((s, idx) => ({ ...s, order: idx }));

            return { ...doc, slides, updatedAt: new Date().toISOString() };
          }),
          activeSlideId: state.activeSlideId === slideId ? null : state.activeSlideId
        }));
      },

      duplicateSlide: (documentId, slideId) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            const sourceSlide = doc.slides.find((s) => s.id === slideId);
            if (!sourceSlide) return doc;

            const newSlide: StudioSlide = {
              ...sourceSlide,
              id: generateId(),
              order: sourceSlide.order + 1,
              title: `${sourceSlide.title} (副本)`,
              status: "edited",
              lastEditedAt: new Date().toISOString()
            };

            const slides = [...doc.slides];
            slides.splice(sourceSlide.order + 1, 0, newSlide);

            const reorderedSlides = slides.map((s, idx) => ({ ...s, order: idx }));

            return { ...doc, slides: reorderedSlides, updatedAt: new Date().toISOString() };
          })
        }));
      },

      setActiveSlide: (slideId) => {
        set({ activeSlideId: slideId });
      },

      // Batch operations
      batchUpdateSlides: (documentId, updates) => {
        set((state) => ({
          documents: state.documents.map((doc) => {
            if (doc.id !== documentId) return doc;

            const updateMap = new Map(updates.map((u) => [u.slideId, u.updates]));

            return {
              ...doc,
              slides: doc.slides.map((slide) => {
                const slideUpdates = updateMap.get(slide.id);
                return slideUpdates
                  ? { ...slide, ...slideUpdates, lastEditedAt: new Date().toISOString() }
                  : slide;
              }),
              updatedAt: new Date().toISOString()
            };
          })
        }));
      },

      setSlideStatus: (documentId, slideId, status) => {
        get().updateSlide(documentId, slideId, { status });
      },

      // UI state
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      setGenerating: (generating, slideIds) => {
        set({
          isGenerating: generating,
          generatingSlideIds: slideIds ? new Set(slideIds) : new Set()
        });
      },

      // Getters
      getActiveDocument: () => {
        const state = get();
        return state.documents.find((doc) => doc.id === state.activeDocumentId) ?? null;
      },

      getActiveSlide: () => {
        const state = get();
        const doc = state.getActiveDocument();
        if (!doc || !state.activeSlideId) return null;
        return doc.slides.find((slide) => slide.id === state.activeSlideId) ?? null;
      },

      getSlideById: (documentId, slideId) => {
        const doc = get().documents.find((d) => d.id === documentId);
        if (!doc) return null;
        return doc.slides.find((s) => s.id === slideId) ?? null;
      },

      getDocumentById: (id) => {
        return get().documents.find((doc) => doc.id === id) ?? null;
      }
    }),
    {
      name: "presentation-studio-storage",
      // 只持久化documents，不持久化UI状态
      partialize: (state) => ({
        documents: state.documents,
        activeDocumentId: state.activeDocumentId
      }),
      // 跳过SSR hydration，只在客户端使用localStorage
      skipHydration: true
    }
  )
);
