import { create } from "zustand";

export interface CopilotTimelineEntry {
  id: string;
  prompt: string;
  parentVersionId: string;
  parentVersionLabel: string;
  resultVersionId: string;
  resultVersionLabel: string;
  changeSetId?: string;
  proposalId?: string;
  createdAt: string;
  status: "applied" | "undone";
}

interface CopilotTimelineStore {
  entries: CopilotTimelineEntry[];
  addEntry: (entry: Omit<CopilotTimelineEntry, "id" | "createdAt" | "status">) => CopilotTimelineEntry;
  markUndone: (entryId: string) => void;
  markApplied: (entryId: string) => void;
  hydrateEntries: (entries: CopilotTimelineEntry[]) => void;
  clearEntries: () => void;
}

export const useCopilotTimelineStore = create<CopilotTimelineStore>((set) => ({
  entries: [],
  addEntry: (entry) => {
    const created: CopilotTimelineEntry = {
      ...entry,
      id: `timeline-${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: "applied"
    };

    set((state) => ({
      entries: [created, ...state.entries].slice(0, 40)
    }));

    return created;
  },
  markUndone: (entryId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, status: "undone" as const } : entry
      )
    })),
  markApplied: (entryId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, status: "applied" as const } : entry
      )
    })),
  hydrateEntries: (entries) =>
    set({
      entries: entries.slice(0, 40)
    }),
  clearEntries: () => set({ entries: [] })
}));
