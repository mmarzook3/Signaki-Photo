import { describe, expect, it } from "vitest";
import type { Photo } from "@/api/types";
import { filterPhotos, sequence } from "./gallery";
const photos = [
  { id: "a", name: "Kitchen 01", group_id: 1, latest: { status: "pending" } },
  { id: "b", name: "Bedroom 02", group_id: 2, latest: { status: "approved" } },
  { id: "c", name: "Kitchen 03", group_id: null, latest: { status: "review" } },
] as Photo[];
describe("gallery navigation scope", () => {
  it("finds replacement versions independently of feedback and decisions", () => {
    const items = photos.map((p, i) => ({ ...p, latest: { ...p.latest!, number: i + 1 }, unresolved_feedback_count: i === 2 ? 1 : 0 }));
    expect(filterPhotos(items, "", "revised").map(p => p.id)).toEqual(["b", "c"]);
    expect(filterPhotos(items, "kitchen", "revised").map(p => p.id)).toEqual(["c"]);
    expect(filterPhotos(items, "", "unresolved").map(p => p.id)).toEqual(["c"]);
  });
  it("filters unresolved feedback independently of the review decision", () => {
    const items = photos.map((p, i) => ({ ...p, unresolved_feedback_count: i < 2 ? 2 : 0 }));
    expect(filterPhotos(items, "", "unresolved").map(p => p.id)).toEqual(["a", "b"]);
    expect(filterPhotos(items, "bedroom", "unresolved").map(p => p.id)).toEqual(["b"]);
    expect(filterPhotos(items, "", "review").map(p => p.id)).toEqual(["c"]);
  });
  it("combines filename and status without mutating the original", () => {
    expect(
      filterPhotos(photos, " KITCHEN ", "pending").map((p) => p.id),
    ).toEqual(["a"]);
    expect(photos).toHaveLength(3);
  });
  it("keeps ungrouped navigation separate", () => {
    expect(sequence(photos, "none").map((p) => p.id)).toEqual(["c"]);
    expect(sequence(photos, "1").map((p) => p.id)).toEqual(["a"]);
  });
  it("does not silently show stale matches for an empty search result", () =>
    expect(filterPhotos(photos, "not found", "all")).toEqual([]));
});
