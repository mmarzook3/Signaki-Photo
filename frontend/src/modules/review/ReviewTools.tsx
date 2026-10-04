import { ViewerMenu, ViewerMenuItem } from "@/modules/viewer/ViewerMenu";
import {
  ChevronDown,
  Circle,
  Layers,
  Columns2,
  PanelRight,
} from "lucide-react";
import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Pencil,
  SlidersHorizontal,
  Download,
  Info,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write, message } from "@/api/client";
import type { Photo, Property, Version } from "@/api/types";
import { useUser } from "@/modules/session/Session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/common";
import { can } from "./types";
import { GallerySettings } from "./GallerySettings";
import { DecisionControl } from "./DecisionControl";
export function ReviewTools({
  photo,
  property,
  version,
  onComment,
  onDraw,
  drawing,
  onVersion,
  compare,
  onCompare,
  panel,
  onPanel,
}: {
  onVersion: (id: string) => void;
  compare: boolean;
  onCompare: () => void;
  panel: boolean;
  onPanel: () => void;
  photo: Photo;
  property: Property;
  version: Version;
  onComment: () => void;
  onDraw: () => void;
  drawing: boolean;
}) {
  const user = useUser();
  const query = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const [info, setInfo] = useState(false);
  const s = property.review_settings;
  const allowed = (key: Parameters<typeof can>[2]) =>
    can(user.is_staff, s, key);
  const metadata = useQuery({
    queryKey: ["information", version.id],
    queryFn: () =>
      api<{
        name: string;
        width: number;
        height: number;
        bytes: number;
        format: string;
        kind: string;
      }>(`versions/${version.id}/information/`),
    enabled: info && allowed("file_information"),
  });
  async function change(path: string, data: unknown) {
    setBusy(true);
    setError("");
    try {
      await write(path, data, "PUT");
      await Promise.all([
        query.invalidateQueries({ queryKey: ["photo", photo.id] }),
        query.invalidateQueries({ queryKey: ["gallery", property.id] }),
      ]);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {allowed("versioning") && (
        <ViewerMenu
          label="View version"
          trigger={
            <>
              <Layers />
              <span>V{version.number}</span>
              <ChevronDown size={16} />
            </>
          }
        >
          {photo.versions.map((v) => (
            <ViewerMenuItem
              key={v.id}
              selected={v.id === version.id}
              onSelect={() => onVersion(v.id)}
            >
              <Layers />
              <span>Version {v.number}</span>
              {v.id === photo.latest?.id && <small>Latest</small>}
            </ViewerMenuItem>
          ))}
        </ViewerMenu>
      )}
      {allowed("favorites") && (
        <Button
          className="review-pill"
          variant="ghost"
          size="icon"
          aria-label="Favorite photo"
          aria-pressed={photo.favorite}
          disabled={busy}
          onClick={() =>
            change(`photos/${photo.id}/favorite/`, {
              favorite: !photo.favorite,
            })
          }
        >
          <Heart size={20} fill={photo.favorite ? "currentColor" : "none"} />
        </Button>
      )}
      {!user.is_staff && allowed("asset_status") && (
        <DecisionControl
          endpoint={`versions/${version.id}/decision/`}
          revision={version.review_revision}
          status={version.status}
          choices={s.allowed_statuses}
        />
      )}
      {allowed("color_labels") && (
        <ViewerMenu
          label="Color label"
          trigger={
            <>
              <span
                className="color-swatch"
                style={{
                  color:
                    s.labels.find((x) => x.id === photo.color_label)?.color ||
                    "#fff",
                }}
              />
              <span>
                {s.labels.find((x) => x.id === photo.color_label)?.name ||
                  "Label"}
              </span>
              <ChevronDown size={17} />
            </>
          }
        >
          {s.labels
            .filter((x) => x.enabled)
            .map((x) => (
              <ViewerMenuItem
                key={x.id}
                disabled={busy}
                selected={photo.color_label === x.id}
                onSelect={() =>
                  change(`photos/${photo.id}/label/`, { label: x.id })
                }
              >
                <span className="color-swatch" style={{ color: x.color }} />
                <span>{x.name}</span>
              </ViewerMenuItem>
            ))}
          <ViewerMenuItem
            disabled={busy}
            selected={!photo.color_label}
            onSelect={() => change(`photos/${photo.id}/label/`, { label: "" })}
          >
            <Circle strokeDasharray="2 3" />
            <span>Not labeled</span>
          </ViewerMenuItem>
        </ViewerMenu>
      )}
      {allowed("comments") && (
        <Button className="review-pill" variant="ghost" onClick={onComment}>
          <MessageCircle size={17} />
          Comment
        </Button>
      )}
      {allowed("comments") && allowed("annotations") && (
        <Button
          className="review-pill"
          variant="ghost"
          aria-pressed={drawing}
          onClick={onDraw}
        >
          <Pencil size={17} />
          Draw
        </Button>
      )}
      <ViewerMenu label="Viewer options" trigger={<SlidersHorizontal />}>
        <ViewerMenuItem onSelect={onPanel}>
          <PanelRight />
          <span>{panel ? "Hide feedback" : "Show feedback"}</span>
        </ViewerMenuItem>
        {photo.versions.length > 1 && (
          <ViewerMenuItem onSelect={onCompare}>
            <Columns2 />
            <span>{compare ? "Close comparison" : "Compare versions"}</span>
          </ViewerMenuItem>
        )}
        {allowed("file_information") && (
          <ViewerMenuItem onSelect={() => setInfo(true)}>
            <Info />
            <span>File information</span>
          </ViewerMenuItem>
        )}
        {allowed("download") && (
          <ViewerMenuItem
            onSelect={() => {
              window.location.href = `/api/v1/versions/${version.id}/download/`;
            }}
          >
            <Download />
            <span>Download review copy</span>
          </ViewerMenuItem>
        )}
        {user.is_staff && (
          <ViewerMenuItem onSelect={() => setSettings(true)}>
            <SlidersHorizontal />
            <span>Gallery settings</span>
          </ViewerMenuItem>
        )}
      </ViewerMenu>
      {error && <ErrorNotice error={error} />}
      {user.is_staff && (
        <GallerySettings
          property={property}
          open={settings}
          onOpenChange={setSettings}
        />
      )}
      <Dialog open={info} onOpenChange={setInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>File information</DialogTitle>
            <DialogDescription>
              Details of this review copy. Original photographs are delivered
              separately.
            </DialogDescription>
          </DialogHeader>
          {metadata.error ? (
            <ErrorNotice error={message(metadata.error)} />
          ) : metadata.data ? (
            <dl>
              <dt>Filename</dt>
              <dd>{metadata.data.name}</dd>
              <dt>Dimensions</dt>
              <dd>
                {metadata.data.width} × {metadata.data.height}
              </dd>
              <dt>Size</dt>
              <dd>
                {Math.round(metadata.data.bytes / 1024)} KB ·{" "}
                {metadata.data.format}
              </dd>
            </dl>
          ) : (
            <p>Loading…</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
