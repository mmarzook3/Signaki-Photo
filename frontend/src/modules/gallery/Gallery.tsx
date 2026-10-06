import { GalleryActivity } from "@/modules/review/GalleryActivity";
import { GallerySettings } from "@/modules/review/GallerySettings";
import { DecisionControl } from "@/modules/review/DecisionControl";
import { can } from "@/modules/review/types";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  SlidersHorizontal,
  Search,
  Grid2X2,
  ChevronRight,
  Folder,
  Upload,
  Check,
  Circle,
  RefreshCw,
  X,
  Filter,
  MessageCircle,
} from "lucide-react";
import { api, message } from "@/api/client";
import type { Gallery as GalleryData, Photo, Status } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNotice, Loading, Empty, StatusBadge } from "@/components/common";
import { useUser } from "@/modules/session/Session";
import { PropertyEditor } from "@/modules/properties/PropertyEditor";
import { DeliveryLink } from "@/modules/properties/Dashboard";
import { UploadDialog } from "@/modules/uploads/UploadDialog";
import { useGalleryPreferences } from "./preferences";
import { filterPhotos, statuses } from "@/lib/gallery";
const EMPTY_ROOMS: string[] = [];
export interface GallerySearch {
  q?: string;
  status?: Status | "all" | "unresolved";
  view?: "all" | "grouped";
  group?: string;
  compact?: boolean;
  scopeGroup?: string;
}
export function Gallery() {
  const { propertyId = "" } = useParams({ strict: false });
  const search = useSearch({ strict: false }) as GallerySearch;
  const navigate = useNavigate();
  const user = useUser();
  const [reviewSettings, setReviewSettings] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [labelFilter, setLabelFilter] = useState("");
  const [settings, setSettings] = useState(false);
  const [upload, setUpload] = useState(false);
  const [filters, setFilters] = useState(false);
  const expanded = useGalleryPreferences(
    (s) => s.rooms[propertyId] || EMPTY_ROOMS,
  );
  const toggleRoom = useGalleryPreferences((s) => s.toggle);
  const result = useQuery({
    queryKey: ["gallery", propertyId],
    queryFn: () => api<GalleryData>(`properties/${propertyId}/`),
    refetchInterval: (q) => q.state.data?.photos.some(p => p.latest?.processing === "queued" || p.latest?.processing === "processing") ? 3000 : false,
  });
  const update = (values: Partial<GallerySearch>) =>
    navigate({
      to: "/app/properties/$propertyId",
      params: { propertyId },
      search: { ...search, ...values },
      replace: true,
      resetScroll: false,
    });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={message(result.error)} />;
  const { property, groups, photos } = result.data;
  const workflow = can(user.is_staff, property.review_settings, "workflow");
  let shown = filterPhotos(
    photos,
    workflow ? search.q || "" : "",
    workflow ? search.status || "all" : "all",
  );
  if (workflow && favoriteOnly) shown = shown.filter((p) => p.favorite);
  if (workflow && labelFilter)
    shown = shown.filter((p) => p.color_label === labelFilter);
  if (workflow && search.group)
    shown = shown.filter((p) => String(p.group_id ?? "none") === search.group);
  const counts = Object.fromEntries(
    Object.keys(statuses).map((s) => [
      s,
      photos.filter((p) => p.latest?.status === s).length,
    ]),
  );
  const sections =
    search.view === "grouped"
      ? [
          ...groups.map((g) => ({
            key: String(g.id),
            label: g.name,
            photos: shown.filter((p) => p.group_id === g.id),
          })),
          {
            key: "none",
            label: "Ungrouped",
            photos: shown.filter((p) => p.group_id === null),
          },
        ].filter(
          (g) => g.photos.length || groups.some((x) => String(x.id) === g.key),
        )
      : [{ key: "all", label: "All media", photos: shown }];
  const reviewed = photos.filter(
    (p) => p.latest && p.latest.status !== "pending",
  ).length;
  return (
    <div className="gallery-workspace">
      <header className="gallery-header">
        <Link className="icon-link" to="/app" aria-label="Back to properties">
          <ArrowLeft size={21} />
        </Link>
        <span className="brand-mark">S</span>
        <div className="gallery-title">
          <span className="caption">PROPERTY COLLECTION</span>
          <h1>{property.name}</h1>
        </div>
        <div className="mode-switch" aria-label="Gallery view">
          <button
            className={search.view !== "grouped" ? "active" : ""}
            onClick={() => update({ view: "all" })}
          >
            All media
          </button>
          <button
            className={search.view === "grouped" ? "active" : ""}
            onClick={() => update({ view: "grouped" })}
          >
            By room
          </button>
        </div>
        <div className="gallery-actions">
          <DeliveryLink property={property} />
          {can(user.is_staff, property.review_settings, "gallery_status") && (
            <GalleryActivity propertyId={property.id} />
          )}
          {!user.is_staff &&
            can(false, property.review_settings, "gallery_status") && (
              <DecisionControl
                gallery
                endpoint={`properties/${property.id}/decision/`}
                revision={property.review_revision}
                status={property.review_status}
                choices={["approved", "review", "rejected", "in_progress"]}
              />
            )}
          {!user.is_staff && can(false, property.review_settings, "upload") && (
            <Button onClick={() => setUpload(true)}>Upload photos</Button>
          )}
          {user.is_staff && (
            <Button variant="outline" onClick={() => setReviewSettings(true)}>
              Gallery settings
            </Button>
          )}
          {user.is_staff && (
            <>
              <Button onClick={() => setUpload(true)}>
                <Upload size={16} />
                <span>Upload</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSettings(true)}
                aria-label="Property settings"
              >
                <SlidersHorizontal size={18} />
              </Button>
            </>
          )}
        </div>
      </header>
      <div className="gallery-body">
        {workflow && (
          <aside className={`filter-rail ${filters ? "show-mobile" : ""}`}>
            <div className="review-summary">
              <p className="nav-label">REVIEW PROGRESS</p>
              <strong>
                {reviewed}
                <span> / {photos.length}</span>
              </strong>
              <progress value={reviewed} max={Math.max(photos.length, 1)} />
              <p className="caption">items reviewed</p>
            </div>
            <p className="filter-title">Status</p>
            <button
              className={`filter-option ${!search.status || search.status === "all" ? "active" : ""}`}
              onClick={() => update({ status: "all" })}
            >
              <Grid2X2 size={17} />
              All media<span>{photos.length}</span>
            </button>
            {(Object.keys(statuses) as Status[]).map((s) => {
              const Icon = {
                approved: Check,
                review: RefreshCw,
                rejected: X,
                pending: Circle,
                in_progress: Circle,
              }[s];
              return (
                <button
                  key={s}
                  className={`filter-option ${search.status === s ? "active" : ""}`}
                  onClick={() => update({ status: s })}
                >
                  <Icon size={17} className={`text-${s}`} />
                  {statuses[s]}
                  <span>{counts[s]}</span>
                </button>
              );
            })}
            {can(user.is_staff, property.review_settings, "comments") && (
              <button
                className={`filter-option ${search.status === "unresolved" ? "active" : ""}`}
                aria-pressed={search.status === "unresolved"}
                title="Media with unresolved comments, including earlier visible versions"
                onClick={() => update({ status: "unresolved" })}
              >
                <MessageCircle size={17} />
                Unresolved feedback
                <span>{photos.filter(p => (p.unresolved_feedback_count ?? 0) > 0).length}</span>
              </button>
            )}
            {can(user.is_staff, property.review_settings, "favorites") && (
              <label className="setting-row">
                <span>Favorites only</span>
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(e) => setFavoriteOnly(e.target.checked)}
                />
              </label>
            )}
            {can(user.is_staff, property.review_settings, "color_labels") && (
              <select
                aria-label="Filter color label"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
              >
                <option value="">All labels</option>
                {property.review_settings.labels
                  .filter((x) => x.enabled)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            )}
            <hr />
            <p className="filter-title">Rooms & locations</p>
            <button
              className={`filter-option ${!search.group ? "active" : ""}`}
              onClick={() => update({ group: undefined })}
            >
              <Folder size={17} />
              Every room
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                className={`filter-option ${search.group === String(g.id) ? "active" : ""}`}
                onClick={() => update({ group: String(g.id) })}
              >
                <Folder size={15} />
                <span className="room-name">{g.name}</span>
              </button>
            ))}
            <p className="rail-note">
              Review previews.
              <br />
              Final files delivered separately.
            </p>
          </aside>
        )}
        <main className={`gallery-canvas ${search.compact ? "compact" : ""}`}>
          <div className="gallery-toolbar">
            <Button
              className="mobile-filter"
              variant="outline"
              size="icon"
              aria-label="Toggle filters"
              aria-expanded={filters}
              onClick={() => setFilters(!filters)}
            >
              <Filter size={17} />
            </Button>
            {workflow && (
              <div className="search-field">
                <Search size={16} />
                <Input
                  aria-label="Search files"
                  placeholder="Search filenames…"
                  value={search.q || ""}
                  onChange={(e) => update({ q: e.target.value })}
                />
              </div>
            )}
            <span className="caption result-count" aria-live="polite">
              {shown.length} files
            </span>
            <Button
              variant="outline"
              aria-pressed={Boolean(search.compact)}
              onClick={() => update({ compact: !search.compact })}
            >
              <Grid2X2 size={16} />
              {search.compact ? "Comfortable" : "Compact"}
            </Button>
          </div>
          {(search.q ||
            (search.status && search.status !== "all") ||
            search.group) && (
            <div className="active-filters">
              <span>Filtered collection</span>
              <button
                onClick={() =>
                  update({ q: "", status: "all", group: undefined })
                }
              >
                Clear filters <X size={13} />
              </button>
            </div>
          )}
          {sections.map((section) => {
            const grouped = search.view === "grouped";
            const isOpen = !grouped || expanded.includes(section.key);
            return (
              <section className="room-section" key={section.key}>
                {grouped ? (
                  <button
                    className="room-heading"
                    aria-expanded={isOpen}
                    onClick={() => toggleRoom(propertyId, section.key)}
                  >
                    <ChevronRight
                      size={17}
                      className={isOpen ? "rotate-90" : ""}
                    />
                    <Folder size={17} />
                    <strong>{section.label}</strong>
                    <span>{section.photos.length}</span>
                  </button>
                ) : (
                  <div className="collection-heading">
                    <h2>{property.name}</h2>
                    <span className="caption">
                      Latest versions · Select a photo or video to review
                    </span>
                  </div>
                )}
                {isOpen && (
                  <div className="photo-grid">
                    {section.photos.map((photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                        search={{
                          ...search,
                          scopeGroup: grouped ? section.key : undefined,
                        }}
                      />
                    ))}
                    {!section.photos.length && (
                      <p className="muted">No files in this room.</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          {!shown.length && (
            <Empty
              title="No matching files"
              text="Try a different filename, room or status."
            />
          )}
        </main>
      </div>
      {!user.is_staff && can(false, property.review_settings, "upload") && (
        <UploadDialog
          propertyId={propertyId}
          groups={groups}
          open={upload}
          onOpenChange={setUpload}
        />
      )}
      {user.is_staff && (
        <>
          <PropertyEditor
            property={property}
            open={settings}
            onOpenChange={setSettings}
          />
          <GallerySettings
            property={property}
            open={reviewSettings}
            onOpenChange={setReviewSettings}
          />
          <UploadDialog
            propertyId={propertyId}
            groups={groups}
            open={upload}
            onOpenChange={setUpload}
          />
        </>
      )}
    </div>
  );
}
function PhotoCard({ photo, search }: { photo: Photo; search: GallerySearch }) {
  if (!photo.latest) return null;
  return (
    <Link
      className="photo-card"
      to="/app/photos/$photoId"
      params={{ photoId: photo.id }}
      search={{ ...search, version: undefined }}
      resetScroll
    >
      <div className="photo-thumb">
        <img
          src={photo.latest.thumb_url}
          alt={`${photo.name}, version ${photo.latest.number}`}
          loading="lazy"
          decoding="async"
        />
        <span className="photo-version">{photo.latest.media_kind === "video" ? "▶ Video · " : ""}v{photo.latest.number}{photo.latest.processing && photo.latest.processing !== "ready" ? ` · ${photo.latest.processing}` : ""}</span>
      </div>
      <div className="photo-caption">
        <strong title={photo.name}>{photo.name}</strong>
        {photo.hidden && <span>Hidden</span>}
        {photo.favorite && <span aria-label="Favorite">&#9829;</span>}
        {photo.color_label && (
          <span
            className={`label-dot label-${photo.color_label}`}
            aria-label={`${photo.color_label} label`}
          />
        )}
      </div>
      <StatusBadge status={photo.latest.status} />
      {(photo.unresolved_feedback_count ?? 0) > 0 && (
        <span className="caption">{photo.unresolved_feedback_count} unresolved comment{photo.unresolved_feedback_count === 1 ? "" : "s"}</span>
      )}
    </Link>
  );
}
