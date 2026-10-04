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
}: {
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
      {allowed("favorites") && (
        <Button
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
        <select
          aria-label="Color label"
          value={photo.color_label}
          disabled={busy}
          onChange={(e) =>
            change(`photos/${photo.id}/label/`, { label: e.target.value })
          }
        >
          <option value="">Label</option>
          {s.labels
            .filter((x) => x.enabled)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      )}
      {allowed("comments") && (
        <Button variant="ghost" onClick={onComment}>
          <MessageCircle size={17} />
          Comment
        </Button>
      )}
      {allowed("comments") && allowed("annotations") && (
        <Button variant="ghost" aria-pressed={drawing} onClick={onDraw}>
          <Pencil size={17} />
          Draw
        </Button>
      )}
      {allowed("file_information") && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="File information"
          onClick={() => setInfo(true)}
        >
          <Info size={18} />
        </Button>
      )}
      {allowed("download") && (
        <a
          className="icon-link"
          aria-label="Download review copy"
          href={`/api/v1/versions/${version.id}/download/`}
        >
          <Download size={18} />
        </a>
      )}
      {user.is_staff && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Gallery settings"
          onClick={() => setSettings(true)}
        >
          <SlidersHorizontal size={19} />
        </Button>
      )}
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
