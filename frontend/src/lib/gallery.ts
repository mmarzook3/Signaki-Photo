import type { Photo, Status } from "@/api/types";
export const statuses: Record<Status, string> = {
  in_progress: "In progress",
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
  review: "Changes needed",
};
export function filterPhotos(photos: Photo[], search: string, status: string) {
  const query = search.trim().toLowerCase();
  return photos.filter(
    (p) =>
      p.latest &&
      p.name.toLowerCase().includes(query) &&
      (status === "unresolved"
        ? (p.unresolved_feedback_count ?? 0) > 0
        : status === "revised"
          ? p.latest.number > 1
          : status === "all" || p.latest.status === status),
  );
}
export function sequence(photos: Photo[], group?: string) {
  return group === undefined
    ? photos
    : photos.filter((p) => String(p.group_id ?? "none") === group);
}
