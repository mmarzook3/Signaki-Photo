import type { Annotation } from "@/modules/review/types";
import { create } from "zustand";
interface Drafts {
  shapes: Record<string, Annotation[]>;
  setShapes: (key: string, value: Annotation[]) => void;
  values: Record<string, string>;
  set: (key: string, value: string) => void;
}
export const useDrafts = create<Drafts>((set) => ({
  shapes: {},
  setShapes: (key, value) =>
    set((state) => ({ shapes: { ...state.shapes, [key]: value } })),
  values: {},
  set: (key, value) =>
    set((state) => ({ values: { ...state.values, [key]: value } })),
}));
