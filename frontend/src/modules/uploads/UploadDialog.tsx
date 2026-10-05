import { useUser } from "@/modules/session/Session";
import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Plus } from "lucide-react";
import { api, write, message } from "@/api/client";
import type { Group, UploadResult } from "@/api/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorNotice } from "@/components/common";
const SuccessAnimation = lazy(() => import("./UploadSuccess"));
export function UploadDialog({
  propertyId,
  groups,
  open,
  onOpenChange,
}: {
  propertyId: string;
  groups: Group[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useUser();
  const query = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [group, setGroup] = useState("");
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<UploadResult["items"]>([]);
  const refresh = async () => {
    await query.invalidateQueries({ queryKey: ["gallery", propertyId] });
    await query.invalidateQueries({ queryKey: ["properties"] });
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add photos or videos</DialogTitle>
          <DialogDescription>
            Source uploads are converted to watermarked review copies.
          </DialogDescription>
        </DialogHeader>
        <div className="form-stack">
          {error && <ErrorNotice error={error} />}
          <label>
            Room or location
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Ungrouped</option>
              {groups.map((g) => (
                <option value={g.id} key={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          {user.is_staff && (
            <div className="inline-form">
              <Input
                aria-label="New room name"
                placeholder="New room name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={!groupName.trim() || busy}
                onClick={async () => {
                  setError("");
                  try {
                    const g = await write<Group>(
                      `properties/${propertyId}/groups/`,
                      { name: groupName, position: groups.length },
                    );
                    setGroup(String(g.id));
                    setGroupName("");
                    await refresh();
                  } catch (err) {
                    setError(message(err));
                  }
                }}
              >
                <Plus size={16} />
                Add room
              </Button>
            </div>
          )}
          <label
            className="upload-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) {
                setFiles(Array.from(e.dataTransfer.files));
                setResults([]);
              }
            }}
          >
            <UploadCloud size={35} />
            <strong>Drop photos or videos here or choose files</strong>
            <span>JPEG, PNG, WebP, MP4, MOV or WebM · up to 10 files</span>
            <input
              aria-label="Choose photographs"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.m4v"
              disabled={busy}
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setResults([]);
              }}
            />
          </label>
          <p className="caption">
            Photos: 25 MB. Videos: 250 MB, up to 5 minutes. Total: 250 MB. Video previews process in the background.
          </p>
          {files.length > 0 && (
            <p>
              {files.length} selected ·{" "}
              {(files.reduce((n, f) => n + f.size, 0) / 1024 / 1024).toFixed(1)}{" "}
              MB
            </p>
          )}
          <Button
            disabled={busy || !files.length}
            onClick={async () => {
              setError("");
              setResults([]);
              if (
                files.length > 10 ||
                files.some((f) => f.size > (/\.(mp4|mov|m4v|webm)$/i.test(f.name) ? 250 : 25) * 1024 * 1024) ||
                files.reduce((n, f) => n + f.size, 0) > 250 * 1024 * 1024
              ) {
                setError("Choose up to 10 files within the size limits.");
                return;
              }
              const body = new FormData();
              files.forEach((f) => body.append("photos", f));
              if (group) body.set("group", group);
              setBusy(true);
              try {
                const result = await api<UploadResult>(
                  `properties/${propertyId}/upload/`,
                  { method: "POST", body },
                );
                setResults(result.items);
                setFiles((previous) =>
                  previous.filter((f) =>
                    result.items.some(
                      (r) => !r.ok && r.name === f.name.replace(/\.[^.]+$/, ""),
                    ),
                  ),
                );
                await refresh();
              } catch (err) {
                setError(
                  message(err) +
                    " Reload the gallery before retrying if the connection was lost.",
                );
                await refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Processing watermarked proofs…" : "Upload files"}
          </Button>
          {busy && (
            <p role="status" className="caption">
              Please keep this window open. The gallery refreshes after
              processing.
            </p>
          )}
          {results.map((r, i) => (
            <p className={r.ok ? "upload-ok" : "upload-error"} key={i}>
              {r.name}: {r.ok ? "Uploaded" : r.error}
            </p>
          ))}
          {results.length > 0 && results.every((r) => r.ok) && (
            <Suspense fallback={<p>Upload complete.</p>}>
              <SuccessAnimation />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
