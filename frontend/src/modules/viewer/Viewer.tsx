import { ReviewTools } from "@/modules/review/ReviewTools";
import type { Annotation } from "@/modules/review/types";
import type { DrawTool } from "@/modules/review/AnnotationLayer";
import { can } from "@/modules/review/types";
const NO_SHAPES: Annotation[] = [];
import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  PanelRight,
  Columns2,
  Maximize,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import { api, message } from "@/api/client";
import type { Gallery, PhotoDetail } from "@/api/types";
import type { GallerySearch } from "@/modules/gallery/Gallery";
import { filterPhotos, sequence } from "@/lib/gallery";
import { useUser } from "@/modules/session/Session";
import { useDrafts } from "@/modules/feedback/drafts";
import { Button } from "@/components/ui/button";
import { ErrorNotice, Loading } from "@/components/common";
import { FeedbackPanel } from "@/modules/feedback/FeedbackPanel";
import { ImageStage } from "./ImageStage";
import { PhotoEditor } from "./PhotoEditor";
export function Viewer() {
  const { photoId = "" } = useParams({ strict: false });
  const search = useSearch({ strict: false }) as GallerySearch & {
    version?: string;
  };
  const navigate = useNavigate();
  const user = useUser();
  const [tool, setTool] = useState<DrawTool>(null);
  const [color, setColor] = useState<Annotation["color"]>("#ffcc45");
  const shapes = useDrafts((s) => s.shapes);
  const setShapes = useDrafts((s) => s.setShapes);
  const [panel, setPanel] = useState(true);
  const [compare, setCompare] = useState(false);
  const [comparison, setComparison] = useState("");
  const [edit, setEdit] = useState<"settings" | "replacement" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const details = useQuery({
    queryKey: ["photo", photoId],
    queryFn: () => api<PhotoDetail>(`photos/${photoId}/`),
  });
  const propertyId = details.data?.photo.property_id || "";
  const gallery = useQuery({
    queryKey: ["gallery", propertyId],
    queryFn: () => api<Gallery>(`properties/${propertyId}/`),
    enabled: Boolean(propertyId),
  });
  const draftCount = useDrafts(
    (s) => Object.values(s.values).filter(Boolean).length,
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (draftCount || Object.values(shapes).some((s) => s.length)) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftCount, shapes]);
  const photo = details.data?.photo;
  const selected =
    photo?.versions.find((v) => v.id === search.version) || photo?.latest;
  const scope = sequence(
    gallery.data?.photos || [],
    search.scopeGroup ?? search.group,
  );
  const filtered = filterPhotos(scope, search.q || "", search.status || "all");
  const items = scope.filter(
    (p) => p.id === photoId || filtered.some((f) => f.id === p.id),
  );
  const index = items.findIndex((p) => p.id === photoId);
  const previous = items[index - 1];
  const next = items[index + 1];
  function move(id: string) {
    setTool(null);
    setCompare(false);
    setComparison("");
    navigate({
      to: "/app/photos/$photoId",
      params: { photoId: id },
      search: { ...search, version: undefined },
    });
  }
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable],[role=dialog]",
        ) ||
        document.querySelector("[role=dialog]") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (e.key === "ArrowLeft" && previous) {
        e.preventDefault();
        move(previous.id);
      }
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        move(next.id);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  useEffect(() => {
    const images = [previous?.latest?.image_url, next?.latest?.image_url]
      .filter(Boolean)
      .map((src) => {
        const im = new Image();
        im.src = src!;
        return im;
      });
    return () =>
      images.forEach((im) => {
        im.src = "";
      });
  }, [previous?.latest?.image_url, next?.latest?.image_url]);
  if (details.isPending || (propertyId && gallery.isPending))
    return <Loading />;
  if (details.error || gallery.error)
    return <ErrorNotice error={message(details.error || gallery.error)} />;
  if (!photo || !selected || !gallery.data)
    return (
      <ErrorNotice error="This photograph has no available review version." />
    );
  const other =
    photo.versions.find((v) => v.id === comparison && v.id !== selected.id) ||
    photo.versions.find((v) => v.id !== selected.id);
  const versionChange = (id: string) =>
    navigate({
      to: "/app/photos/$photoId",
      params: { photoId },
      search: { ...search, version: id },
      replace: true,
    });
  return (
    <div ref={root} className={`viewer ${panel ? "with-inspector" : ""}`}>
      <header className="viewer-header">
        <Link
          to="/app/properties/$propertyId"
          params={{ propertyId }}
          search={{
            q: search.q,
            status: search.status,
            view: search.view,
            compact: search.compact,
            group: search.group,
          }}
          className="icon-link"
          aria-label="Back to gallery"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="viewer-filename">
          <strong>{photo.name}</strong>
          <span>{gallery.data.property.name}</span>
        </div>
        <span className="viewer-position">
          {index + 1} / {items.length}
        </span>
        <div className="viewer-header-actions">
          {user.is_staff && (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Photo settings"
                onClick={() => setEdit("settings")}
              >
                <Settings2 size={18} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Upload new version"
                onClick={() => setEdit("replacement")}
              >
                <Upload size={18} />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Full screen"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else root.current?.requestFullscreen().catch(() => {});
            }}
          >
            <Maximize size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={panel ? "Hide feedback" : "Show feedback"}
            aria-pressed={panel}
            onClick={() => setPanel(!panel)}
          >
            <PanelRight size={19} />
          </Button>
        </div>
      </header>
      <main className="viewer-main">
        <div className={`viewer-canvas ${compare ? "compare-mode" : ""}`}>
          <button
            className="edge-arrow previous"
            aria-label="Previous photograph"
            disabled={!previous}
            onClick={() => previous && move(previous.id)}
          >
            <ChevronLeft size={33} />
          </button>
          <div className="stages">
            <div className="version-stage">
              {compare && (
                <span className="comparison-label">
                  Version {selected.number}
                </span>
              )}
              <ImageStage
                key={`${selected.id}-${compare}`}
                src={selected.image_url}
                label={selected.label}
                saved={
                  can(
                    user.is_staff,
                    gallery.data.property.review_settings,
                    "annotations",
                  )
                    ? details.data.comments
                        .filter((c) => c.version_id === selected.id)
                        .flatMap((c) => c.annotations)
                    : NO_SHAPES
                }
                draft={shapes[selected.id] || NO_SHAPES}
                tool={
                  can(
                    user.is_staff,
                    gallery.data.property.review_settings,
                    "annotations",
                  )
                    ? tool
                    : null
                }
                color={color}
                onChange={(s) => {
                  setShapes(selected.id, s);
                  setPanel(true);
                }}
              />
            </div>
            {compare && other && (
              <div className="version-stage">
                <label className="comparison-label">
                  Compare with
                  <select
                    aria-label="Comparison version"
                    value={other.id}
                    onChange={(e) => setComparison(e.target.value)}
                  >
                    {photo.versions
                      .filter((v) => v.id !== selected.id)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          Version {v.number}
                        </option>
                      ))}
                  </select>
                </label>
                <ImageStage
                  key={other.id}
                  src={other.image_url}
                  label={other.label}
                />
              </div>
            )}
          </div>
          <button
            className="edge-arrow next"
            aria-label="Next photograph"
            disabled={!next}
            onClick={() => next && move(next.id)}
          >
            <ChevronRight size={33} />
          </button>
          <div className="viewer-bottom">
            <nav className="filmstrip" aria-label="Nearby photographs">
              {items.slice(Math.max(0, index - 4), index + 5).map((p) => (
                <button
                  key={p.id}
                  aria-current={p.id === photoId ? "page" : undefined}
                  title={p.name}
                  onClick={() => move(p.id)}
                >
                  <img src={p.latest!.thumb_url} alt={p.name} />
                </button>
              ))}
            </nav>
            {tool && (
              <div className="drawing-toolbar" aria-label="Drawing tools">
                <select
                  aria-label="Drawing tool"
                  value={tool}
                  onChange={(e) => setTool(e.target.value as DrawTool)}
                >
                  {["pin", "pen", "rectangle", "ellipse", "arrow"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Drawing color"
                  value={color}
                  onChange={(e) =>
                    setColor(e.target.value as Annotation["color"])
                  }
                >
                  <option value="#ffcc45">Yellow</option>
                  <option value="#ff7185">Pink</option>
                  <option value="#70b7ff">Blue</option>
                </select>
                <Button
                  variant="ghost"
                  disabled={!shapes[selected.id]?.length}
                  onClick={() =>
                    setShapes(
                      selected.id,
                      (shapes[selected.id] || []).slice(0, -1),
                    )
                  }
                >
                  Undo
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShapes(selected.id, [])}
                >
                  Clear draft
                </Button>
                <Button variant="ghost" onClick={() => setTool(null)}>
                  Done drawing
                </Button>
                <span className="caption">
                  Add a comment to save your marks.
                </span>
              </div>
            )}
            <div className="viewer-controls">
              <ReviewTools
                photo={photo}
                property={gallery.data.property}
                version={selected}
                drawing={Boolean(tool)}
                onComment={() => {
                  setPanel(true);
                  setTimeout(
                    () => document.getElementById("new-comment")?.focus(),
                    0,
                  );
                }}
                onDraw={() => {
                  setTool(tool ? null : "pen");
                  setPanel(true);
                }}
              />
              {can(
                user.is_staff,
                gallery.data.property.review_settings,
                "versioning",
              ) && (
                <label className="version-control">
                  <span className="sr-only">View version</span>
                  <select
                    aria-label="View version"
                    value={selected.id}
                    onChange={(e) => versionChange(e.target.value)}
                  >
                    {photo.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        Version {v.number}
                        {v.id === photo.latest?.id ? " · Latest" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {photo.versions.length > 1 && (
                <Button
                  variant="ghost"
                  aria-pressed={compare}
                  onClick={() => setCompare(!compare)}
                >
                  <Columns2 size={17} />
                  {compare ? "Close comparison" : "Compare"}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setPanel(!panel)}>
                <PanelRight size={17} />
                Feedback
              </Button>
            </div>
            <p className="proof-note">
              Watermarked review proof · Full-quality delivery is separate
            </p>
            {selected.note && <p className="version-note">{selected.note}</p>}
          </div>
        </div>
        {panel && (
          <aside className="viewer-inspector">
            <button
              className="mobile-inspector-close"
              aria-label="Close feedback"
              onClick={() => setPanel(false)}
            >
              <X size={19} />
            </button>
            <FeedbackPanel
              key={selected.id}
              photo={photo}
              version={selected}
              comments={details.data.comments}
              onVersion={versionChange}
              settings={gallery.data.property.review_settings}
            />
          </aside>
        )}
      </main>
      {user.is_staff && (
        <PhotoEditor
          photo={photo}
          groups={gallery.data.groups}
          mode={edit}
          onClose={() => setEdit(null)}
        />
      )}
    </div>
  );
}
