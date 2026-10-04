import { AlertCircle, Check, Clock3, Circle, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Status } from "@/api/types";
import { statuses } from "@/lib/gallery";
export function StatusBadge({ status }: { status: Status }) {
  const Icon = {
    approved: Check,
    rejected: X,
    review: RefreshCw,
    pending: Circle,
  }[status];
  return (
    <span className={`status-badge status-${status}`}>
      <Icon size={13} />
      {statuses[status]}
    </span>
  );
}
export function ErrorNotice({ error }: { error: string }) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={17} />
      <span>{error}</span>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Clock3 className="animate-pulse" size={22} />
      Loading your workspace…
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Circle size={27} />
      </div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function SaveButton({
  busy,
  children = "Save changes",
}: {
  busy: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Button disabled={busy} type="submit">
      {busy ? "Saving…" : children}
    </Button>
  );
}
