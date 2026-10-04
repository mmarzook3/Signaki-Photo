import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, message } from "@/api/client";
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
export function GalleryActivity({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const activity = useQuery({
    queryKey: ["gallery", "activity", propertyId],
    queryFn: () =>
      api<
        {
          id: string;
          status: string;
          reason: string;
          author: string;
          created: string;
        }[]
      >(`properties/${propertyId}/decision/`),
    enabled: open,
  });
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Gallery activity
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gallery decisions</DialogTitle>
            <DialogDescription>
              Customer decisions and reasons for the whole collection.
            </DialogDescription>
          </DialogHeader>
          <div className="settings-scroll">
            {activity.error && <ErrorNotice error={message(activity.error)} />}{" "}
            {activity.data?.length === 0 && <p>No gallery decisions yet.</p>}
            {activity.data?.map((d) => (
              <article className="comment" key={d.id}>
                <strong>
                  {statuses[d.status as keyof typeof statuses] || d.status}
                </strong>
                <p>{d.reason || "No additional note."}</p>
                <small>
                  {d.author} · {new Date(d.created).toLocaleString("en-GB")}
                </small>
              </article>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
