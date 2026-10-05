import type { ReviewSettings, Annotation } from "@/modules/review/types";
import type { components } from "./generated";
// DRF emits all declared output fields; OpenAPI optional flags also describe input defaults.
type Output<T> = T extends (infer U)[]
  ? Output<U>[]
  : T extends object
    ? { [K in keyof T]-?: Output<Exclude<T[K], undefined>> }
    : T;
type Schema = components["schemas"];
export type Status = Schema["StatusEnum"] | "in_progress";
export type User = Output<Schema["User"]>;
export type Session = Output<Schema["SessionResponse"]>;
export type Version = Omit<Output<Schema["Version"]>, "status"> & {
  status: Status;
  media_kind?: "image" | "video";
  processing?: "queued" | "processing" | "ready" | "failed";
  processing_error?: string;
  duration?: number;
};
export type Property = Output<Schema["Property"]> & {
  review_settings: ReviewSettings;
  review_status: Status;
  review_revision: number;
  watermark_locked: boolean;
};
export type Group = Output<Schema["Group"]>;
export type Photo = Omit<Output<Schema["Photo"]>, "latest" | "versions"> & {
  favorite: boolean;
  color_label: string;
  latest: Version | null;
  versions: Version[];
};
export type Comment = Output<Schema["Comment"]> & {
  annotations: Annotation[];
  parent: string | null;
  timestamp_seconds?: number | null;
};
export type Gallery = { property: Property; groups: Group[]; photos: Photo[] };
export type PhotoDetail = { photo: Photo; comments: Comment[] };
export type FeedbackPage = Output<Schema["FeedbackResponse"]>;
export interface UploadResult {
  items: { name: string; ok: boolean; error?: string; id?: string }[];
}
