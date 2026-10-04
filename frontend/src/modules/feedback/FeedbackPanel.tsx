import { can, type ReviewSettings } from "@/modules/review/types";
import { useRef, useState } from "react";
import { Check, X, RefreshCw, MessageSquare, CircleCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { write, message } from "@/api/client";
import type { Version, Comment, Photo } from "@/api/types";
import { useUser } from "@/modules/session/Session";
import { useDrafts } from "./drafts";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { ErrorNotice, StatusBadge } from "@/components/common";
export function FeedbackPanel({
  photo,
  version,
  comments,
  onVersion,
  settings,
}: {
  settings?: ReviewSettings;
  photo: Photo;
  version: Version;
  comments: Comment[];
  onVersion: (id: string) => void;
}) {
  const user = useUser();
  const query = useQueryClient();
  const commentsAllowed = !settings || can(user.is_staff, settings, "comments");
  const statusesAllowed =
    !settings || can(user.is_staff, settings, "asset_status");
  const shapes = useDrafts((s) => s.shapes[version.id]);
  const setShapes = useDrafts((s) => s.setShapes);
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decision, setDecision] = useState<"rejected" | "review" | null>(null);
  const draft = useDrafts((s) => s.values[version.id] || "");
  const setDraft = useDrafts((s) => s.set);
  const reasonKey = `${version.id}:reason`;
  const reason = useDrafts((s) => s.values[reasonKey] || "");
  const commentKey = useRef(crypto.randomUUID());
  const decisionKey = useRef(crypto.randomUUID());
  const refresh = async () => {
    await query.invalidateQueries({ queryKey: ["photo", photo.id] });
    await query.invalidateQueries({ queryKey: ["gallery", photo.property_id] });
    await query.invalidateQueries({ queryKey: ["properties"] });
    await query.invalidateQueries({ queryKey: ["feedback"] });
  };
  async function decide(choice: "approved" | "rejected" | "review") {
    setError("");
    setNotice("");
    if (choice !== "approved" && !reason.trim()) {
      setError("Please explain why or describe the changes needed.");
      return;
    }
    setBusy(true);
    try {
      await write(`versions/${version.id}/decision/`, {
        decision: choice,
        text: choice === "approved" ? "" : reason,
        expected_revision: version.review_revision,
        request_id: decisionKey.current,
      });
      decisionKey.current = crypto.randomUUID();
      setDraft(reasonKey, "");
      setDecision(null);
      await refresh();
      setNotice(`Decision saved on version ${version.number}.`);
    } catch (err) {
      setError(message(err));
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="inspector-heading">
        <h2>Review & feedback</h2>
        <span className="caption">VERSION {version.number}</span>
      </div>
      <div className="decision-block">
        <StatusBadge status={version.status} />
        {!user.is_staff && statusesAllowed && (
          <>
            <div className="decision-actions">
              <Button
                disabled={busy}
                variant="outline"
                className="approve-button"
                hidden={
                  settings && !settings.allowed_statuses.includes("approved")
                }
                onClick={() => decide("approved")}
              >
                <Check size={15} />
                Approve
              </Button>
              <Button
                disabled={
                  busy ||
                  (settings && !settings.allowed_statuses.includes("rejected"))
                }
                variant="outline"
                onClick={() => {
                  setDecision("rejected");
                  setError("");
                  decisionKey.current = crypto.randomUUID();
                }}
              >
                <X size={15} />
                Reject
              </Button>
              <Button
                disabled={
                  busy ||
                  (settings && !settings.allowed_statuses.includes("review"))
                }
                variant="outline"
                onClick={() => {
                  setDecision("review");
                  setError("");
                  decisionKey.current = crypto.randomUUID();
                }}
              >
                <RefreshCw size={15} />
                Review
              </Button>
            </div>
            <p className="caption">
              Reject: not needed. Review: changes needed.
              <br />
              Both require your reason.
            </p>
          </>
        )}
      </div>
      {error && !decision && <ErrorNotice error={error} />}
      {notice && (
        <p role="status" className="saved-notice">
          {notice}
        </p>
      )}
      <div className="comment-list">
        <div className="comment-list-title">
          <MessageSquare size={15} />
          <strong>Comments</strong>
          <span>{comments.length}</span>
        </div>
        {comments.length ? (
          comments.map((c) => (
            <article
              key={c.id}
              className={`comment ${c.parent ? "is-reply" : ""} ${c.resolved ? "is-resolved" : ""}`}
            >
              <div className="comment-top">
                <span className="avatar">
                  {(c.author.first_name || c.author.username)[0].toUpperCase()}
                </span>
                <div>
                  <strong>{c.author.first_name || c.author.username}</strong>
                  <time>
                    {new Date(c.created).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <button
                  className="version-chip"
                  onClick={() => onVersion(c.version_id)}
                >
                  v{c.version_number}
                </button>
              </div>
              {c.decision && (
                <StatusBadge status={c.decision as Version["status"]} />
              )}
              <p>{c.text}</p>
              {c.annotations?.length > 0 && (
                <span className="caption">
                  {c.annotations.length} annotation(s) � v{c.version_number}
                </span>
              )}
              {commentsAllowed && c.version_id === version.id && (
                <button
                  className="text-action"
                  onClick={() => {
                    setReply(c.parent || c.id);
                    document.getElementById("new-comment")?.focus();
                  }}
                >
                  Reply
                </button>
              )}
              {c.resolved && (
                <span className="caption">
                  <CircleCheck size={13} />
                  Resolved
                </span>
              )}
              {user.is_staff && (
                <button
                  className="text-action"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await write(`comments/${c.id}/resolve/`, {
                        resolved: !c.resolved,
                      });
                      await refresh();
                    } catch (err) {
                      setError(message(err));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {c.resolved ? "Reopen" : "Mark resolved"}
                </button>
              )}
            </article>
          ))
        ) : (
          <div className="comment-empty">
            <MessageSquare size={28} />
            <p>No comments yet.</p>
            <span>Share your thoughts on this version.</span>
          </div>
        )}
      </div>
      {commentsAllowed && (
        <form
          className="comment-composer"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            setBusy(true);
            setError("");
            setNotice("");
            try {
              await write(`versions/${version.id}/comments/`, {
                text: draft,
                annotations: shapes || [],
                parent_id: reply,
                request_id: commentKey.current,
              });
              setDraft(version.id, "");
              setShapes(version.id, []);
              setReply(null);
              commentKey.current = crypto.randomUUID();
              await refresh();
              setNotice(`Comment saved on version ${version.number}.`);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {reply && (
            <p>
              Replying to a comment{" "}
              <button type="button" onClick={() => setReply(null)}>
                Cancel reply
              </button>
            </p>
          )}
          {Boolean(shapes?.length) && (
            <p>{shapes?.length} annotation(s) ready to save.</p>
          )}
          <label htmlFor="new-comment">
            Comment on version {version.number}
          </label>
          <Textarea
            id="new-comment"
            value={draft}
            onChange={(e) => {
              setDraft(version.id, e.target.value);
              commentKey.current = crypto.randomUUID();
            }}
            maxLength={4000}
            placeholder="What would you like us to know?"
            required
          />
          <Button disabled={busy || !draft.trim()} type="submit">
            {busy ? "Saving…" : "Send comment"}
          </Button>
        </form>
      )}
      <Dialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open && !busy) setDecision(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "rejected"
                ? "Why is this photo not needed?"
                : "What would you like changed?"}
            </DialogTitle>
            <DialogDescription>
              Your reason will be saved with version {version.number} of{" "}
              {photo.name}.
            </DialogDescription>
          </DialogHeader>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (decision) decide(decision);
            }}
          >
            {error && <ErrorNotice error={error} />}
            <label>
              Reason (required)
              <Textarea
                autoFocus
                value={reason}
                required
                maxLength={4000}
                onChange={(e) => {
                  setDraft(reasonKey, e.target.value);
                  decisionKey.current = crypto.randomUUID();
                }}
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : decision === "rejected"
                  ? "Reject photo"
                  : "Request changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
