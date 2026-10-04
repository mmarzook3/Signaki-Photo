import type {Annotation} from "@/modules/review/types";
const EMPTY_SHAPES:Annotation[]=[];
import { useRef, useState } from "react";
import { X, CheckCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { write, message } from "@/api/client";
import type { Comment, Photo, Version } from "@/api/types";
import { useDrafts } from "@/modules/feedback/drafts";
import { useUser } from "@/modules/session/Session";
export function AnchoredConversation({
  photo,
  version,
  thread,
  replies,
  onClose,
  onSent,
  canComment,
}: {
  photo: Photo;
  version: Version;
  thread: Comment | null;
  replies: Comment[];
  onClose: () => void;
  onSent: (id: string) => void;
  canComment: boolean;
}) {
  const query = useQueryClient();
  const user = useUser();
  const key = thread ? `${version.id}:reply:${thread.id}` : version.id;
  const draft = useDrafts((s) => s.values[key] || "");
  const setDraft = useDrafts((s) => s.set);
  const shapes = useDrafts((s) => s.shapes[version.id] || EMPTY_SHAPES);
  const setShapes = useDrafts((s) => s.setShapes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef({ payload: "", id: crypto.randomUUID() });
  async function refresh() {
    await Promise.all(
      ["photo", "gallery", "feedback"].map((k) =>
        query.invalidateQueries({ queryKey: [k] }),
      ),
    );
  }
  return (
    <section
      className="anchor-card"
      role="dialog"
      aria-label={thread ? "Photo conversation" : "Comment on drawing"}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        className="anchor-close"
        aria-label="Close photo comment"
        onClick={onClose}
      >
        <X size={17} />
      </button>
      {thread && (
        <div className="anchor-thread">
          {[thread, ...replies].map((c) => (
            <article key={c.id}>
              <div className="anchor-author">
                <span>
                  {(c.author.first_name || c.author.username)
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <strong>{c.author.first_name || c.author.username}</strong>
                <small>v{c.version_number}</small>
              </div>
              <p>{c.text}</p>
            </article>
          ))}
          {user.is_staff && (
            <button
              className="anchor-resolve"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await write(`comments/${thread.id}/resolve/`, {
                    resolved: !thread.resolved,
                  });
                  await refresh();
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <CheckCheck size={16} />
              {thread.resolved ? "Reopen conversation" : "Resolve conversation"}
            </button>
          )}
        </div>
      )}
      {canComment && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim() || busy) return;
            setBusy(true);
            setError("");
            const payload = {
              text: draft,
              annotations: thread ? [] : shapes,
              parent_id: thread?.id || null,
            };
            const encoded = JSON.stringify(payload);
            if (request.current.payload !== encoded)
              request.current = { payload: encoded, id: crypto.randomUUID() };
            try {
              const result = await write<Comment>(
                `versions/${version.id}/comments/`,
                { ...payload, request_id: request.current.id },
              );
              setDraft(key, "");
              if (!thread) setShapes(version.id, []);
              await refresh();
              onSent(thread?.id || result.id);
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <textarea
            autoFocus
            aria-label={thread ? "Reply on photo" : "Comment on photo"}
            value={draft}
            required
            maxLength={4000}
            placeholder={thread ? "Write a reply…" : "Add a comment…"}
            onChange={(e) => setDraft(key, e.target.value)}
          />
          <div className="anchor-footer">
            <span className="sr-only">{thread?'Reply to this conversation':`${shapes.length} marks · Version ${version.number}`}</span>
            <button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="anchor-error">
          {error}
        </p>
      )}
      <span className="sr-only">{photo.name}</span>
    </section>
  );
}
