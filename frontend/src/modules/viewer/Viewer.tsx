import "./viewer.css";
import { DrawingToolbar } from "./DrawingToolbar";
import { AnchoredConversation } from "./AnchoredConversation";
import { Images } from "lucide-react";
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
  const [color, setColor] = useState<Annotation["color"]>("#4f5bff");
  const shapes = useDrafts((s) => s.shapes);
  const setShapes = useDrafts((s) => s.setShapes);
  const [panel, setPanel] = useState(false);
  const [filmstrip, setFilmstrip] = useState(false);
  const [conversation, setConversation] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [comparison, setComparison] = useState("");
  const [edit, setEdit] = useState<"settings" | "replacement" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const pendingSeek = useRef<number | null>(null);
  const details = useQuery({
    queryKey: ["photo", photoId],
    queryFn: () => api<PhotoDetail>(`photos/${photoId}/`),
    refetchInterval: (q) => q.state.data?.photo.versions.some(v => v.processing === "queued" || v.processing === "processing") ? 3000 : false,
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
    setConversation(null);
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
          "input,textarea,select,[contenteditable],[role=dialog],[role=menu]",
        ) ||
        document.querySelector("[role=dialog],[role=menu]") ||
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
    const images = [previous?.latest?.thumb_url, next?.latest?.thumb_url]
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
  }, [previous?.latest?.thumb_url, next?.latest?.thumb_url]);
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
  const versionChange = (id: string) => {
    setConversation(null);
    setTool(null);
    return navigate({
      to: "/app/photos/$photoId",
      params: { photoId },
      search: { ...search, version: id },
      replace: true,
    });
  };
  const settings = gallery.data.property.review_settings;
  const visibleThreads = can(user.is_staff, settings, "annotations")
    ? details.data.comments.filter(
        (c) =>
          c.version_id === selected.id && !c.parent && c.annotations.length,
      )
    : [];
  const thread = visibleThreads.find((c) => c.id === conversation) || null;
  const draftShapes = shapes[selected.id] || NO_SHAPES;
  const anchor =
    conversation === "draft"
      ? draftShapes.at(-1)?.points.at(-1) || ([0.5, 0.5] as [number, number])
      : thread?.annotations.at(-1)?.points.at(-1) || null;
  return (
    <div
      ref={root}
      className={`viewer viewer-v2 ${panel ? "with-inspector" : ""}`}
    >
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Show thumbnails"
            aria-pressed={filmstrip}
            onClick={() => setFilmstrip(!filmstrip)}
          >
            <Images size={19} />
          </Button>
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
              {selected.media_kind === "video" ? (selected.processing === "ready" ? <video key={selected.id} ref={videoRef} src={selected.image_url} poster={selected.thumb_url} controls controlsList="nodownload" playsInline preload="metadata" aria-label={selected.label} style={{width:"100%",height:"100%",maxHeight:"70vh",objectFit:"contain"}} onTimeUpdate={e => setVideoTime(e.currentTarget.currentTime)} onLoadedMetadata={e => { const time = pendingSeek.current ?? 0; e.currentTarget.currentTime=time; setVideoTime(time); pendingSeek.current=null; }} /> : <div role="status" style={{padding:40}}>{selected.processing === "failed" ? selected.processing_error : "Preparing your watermarked video preview…"}</div>) : <ImageStage
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
                threads={visibleThreads}
                activeThread={conversation}
                onThread={(id) => {
                  setConversation(id);
                  setTool(null);
                }}
                anchor={anchor}
                composer={
                  conversation && anchor ? (
                    <AnchoredConversation
                      key={`${selected.id}-${conversation}`}
                      photo={photo}
                      version={selected}
                      thread={thread}
                      replies={details.data.comments.filter(
                        (c) => c.parent === thread?.id,
                      )}
                      canComment={can(user.is_staff, settings, "comments")}
                      onClose={() => setConversation(null)}
                      onSent={(id) => {
                        setTool(null);
                        setConversation(id);
                      }}
                    />
                  ) : null
                }
                draft={shapes[selected.id] || NO_SHAPES}
                tool={
                  can(
                    user.is_staff,
                    gallery.data.property.review_settings,
                    "annotations",
                  )
                    ? conversation
                      ? null
                      : tool
                    : null
                }
                color={color}
                onChange={(s) => {
                  setShapes(selected.id, s);
                  setConversation("draft");
                }}
              />}
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
            {filmstrip && (
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
            )}
            {tool ? (
              <DrawingToolbar
                tool={tool}
                color={color}
                count={draftShapes.length}
                onTool={(v) => {
                  setTool(v);
                  setConversation(null);
                }}
                onColor={(v) => {
                  setColor(v);
                  setConversation(null);
                }}
                onUndo={() => {
                  setShapes(selected.id, draftShapes.slice(0, -1));
                  setConversation(null);
                }}
                onClear={() => {
                  setShapes(selected.id, []);
                  setConversation(null);
                }}
                onClose={() => {
                  setTool(null);
                  setConversation(null);
                }}
              />
            ) : (
              <div className="viewer-controls">
                <ReviewTools
                  photo={photo}
                  property={gallery.data.property}
                  version={selected}
                  drawing={false}
                  onVersion={versionChange}
                  compare={compare}
                  onCompare={() => {
                    setCompare(!compare);
                    setConversation(null);
                  }}
                  panel={panel}
                  onPanel={() => setPanel(!panel)}
                  onComment={() => {
                    if (selected.media_kind === "video") { videoRef.current?.pause(); setPanel(true); return; }
                    setPanel(false);
                    if (can(user.is_staff, settings, "annotations")) {
                      setTool("pin");
                      setConversation(null);
                    } else setConversation("draft");
                  }}
                  onDraw={() => {
                    setTool("pen");
                    setPanel(false);
                    setConversation(null);
                  }}
                />
              </div>
            )}
            {tool && (
              <p className="drawing-hint">
                {conversation
                  ? "Add your comment beside the mark."
                  : tool === "pin"
                    ? "Click on the photo to leave a comment."
                    : "Draw on the photo to start a conversation."}
              </p>
            )}
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
              videoTime={videoTime}
              onSeek={(id, time) => { if (id !== selected.id) { pendingSeek.current=time; versionChange(id); } else if (videoRef.current) { videoRef.current.currentTime=time; videoRef.current.pause(); } }}
              onPause={() => videoRef.current?.pause()}
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
