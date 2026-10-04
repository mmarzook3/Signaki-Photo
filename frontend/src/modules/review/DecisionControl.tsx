import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { write, message } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/common";
import { statuses } from "@/lib/gallery";
export function DecisionControl({
  endpoint,
  revision,
  status,
  choices,
  gallery = false,
}: {
  endpoint: string;
  revision: number;
  status: string;
  choices: string[];
  gallery?: boolean;
}) {
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const query = useQueryClient();
  return (
    <>
      <select
        className="decision-select"
        aria-label={gallery ? "Gallery status" : "Photo status"}
        value=""
        onChange={(e) => {
          key.current = crypto.randomUUID();
          setError("");
          setReason("");
          setChoice(e.target.value);
        }}
      >
        <option value="">
          {gallery ? "Gallery: " : ""}
          {statuses[status as keyof typeof statuses] || status}
        </option>
        {choices.map((s) => (
          <option key={s} value={s}>
            {statuses[s as keyof typeof statuses] || s}
          </option>
        ))}
      </select>
      <Dialog
        open={Boolean(choice)}
        onOpenChange={(v) => {
          if (!v && !busy) setChoice("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {choice === "review"
                ? "What needs changing?"
                : choice === "rejected"
                  ? "Why is this not needed?"
                  : `Set ${gallery ? "gallery" : "photo"} status`}
            </DialogTitle>
            <DialogDescription>
              {gallery
                ? "This decision applies to the entire gallery."
                : "Your decision is attached to the selected photo version."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await write(endpoint, {
                  decision: choice,
                  text: reason,
                  expected_revision: revision,
                  request_id: key.current,
                });
                await Promise.all(
                  ["gallery", "photo", "properties", "feedback"].map((k) =>
                    query.invalidateQueries({ queryKey: [k] }),
                  ),
                );
                setChoice("");
              } catch (err) {
                setError(message(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {["review", "rejected"].includes(choice)
                ? "Reason (required)"
                : "Note (optional)"}
              <textarea
                aria-label="Decision reason"
                required={["review", "rejected"].includes(choice)}
                maxLength={4000}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  key.current = crypto.randomUUID();
                }}
              />
            </label>
            {error && <ErrorNotice error={error} />}
            <Button disabled={busy} type="submit">
              Save decision
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
