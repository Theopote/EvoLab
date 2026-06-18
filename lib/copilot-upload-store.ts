import { create } from "zustand";

interface CopilotUploadStore {
  uploadRequestId: number;
  requestUploadPicker: () => void;
}

export const useCopilotUploadStore = create<CopilotUploadStore>((set) => ({
  uploadRequestId: 0,
  requestUploadPicker: () =>
    set((state) => ({
      uploadRequestId: state.uploadRequestId + 1
    }))
}));
