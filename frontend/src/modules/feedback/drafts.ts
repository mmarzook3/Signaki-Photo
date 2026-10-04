import { create } from "zustand";
interface Drafts {
  values: Record<string, string>;
  set: (key: string, value: string) => void;
}
export const useDrafts = create<Drafts>((set) => ({
  values: {},
  set: (key, value) =>
    set((state) => ({ values: { ...state.values, [key]: value } })),
}));
