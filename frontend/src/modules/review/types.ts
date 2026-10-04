export type Annotation = {
  kind: "pin" | "pen" | "rectangle" | "ellipse" | "arrow";
  color: "#ffcc45" | "#ff7185" | "#70b7ff" | "#4f5bff" | "#58c99a" | "#f2c94c" | "#f2594b";
  points: [number, number][];
};
export type Label = {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
};
export interface ReviewSettings {
  view_only: boolean;
  gallery_status: boolean;
  asset_status: boolean;
  favorites: boolean;
  comments: boolean;
  annotations: boolean;
  color_labels: boolean;
  download: boolean;
  upload: boolean;
  file_information: boolean;
  workflow: boolean;
  versioning: boolean;
  watermark: boolean;
  approved_downloads_only: boolean;
  allowed_statuses: string[];
  labels: Label[];
}
export type Capability = Exclude<
  keyof ReviewSettings,
  "labels" | "allowed_statuses"
>;
export function can(staff: boolean, settings: ReviewSettings, key: Capability) {
  if (staff) return true;
  if (
    settings.view_only &&
    [
      "gallery_status",
      "asset_status",
      "favorites",
      "comments",
      "annotations",
      "color_labels",
      "upload",
    ].includes(key)
  )
    return false;
  return settings[key];
}
