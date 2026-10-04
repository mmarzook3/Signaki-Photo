import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, write, message } from "@/api/client";
import type { Property } from "@/api/types";
import type { ReviewSettings, Capability } from "./types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ErrorNotice } from "@/components/common";
type Preset = {
  id: string;
  name: string;
  config: ReviewSettings;
  standard: boolean;
};
const sections: [string, [Capability, string][]][] = [
  [
    "Collaboration",
    [
      ["gallery_status", "Gallery status"],
      ["asset_status", "Asset status"],
      ["favorites", "Favorites"],
      ["comments", "Comments"],
      ["annotations", "Annotations"],
      ["color_labels", "Color labels"],
    ],
  ],
  [
    "Access & security",
    [
      ["view_only", "View-only access"],
      ["download", "Download review copies"],
      ["approved_downloads_only", "Only approved downloads"],
      ["upload", "Customer upload"],
      ["file_information", "File information"],
      ["workflow", "Workflow access"],
      ["versioning", "Versioning"],
      ["watermark", "Watermark"],
    ],
  ],
];
export function GallerySettings({
  property,
  open,
  onOpenChange,
}: {
  property: Property;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="review-settings-dialog">
        <DialogHeader>
          <DialogTitle>Gallery settings</DialogTitle>
          <DialogDescription>
            Choose how your customer can review this collection. Changes apply
            to this property only.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <SettingsForm
            key={JSON.stringify(property.review_settings)}
            property={property}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function SettingsForm({ property }: { property: Property }) {
  const query = useQueryClient();
  const [draft, setDraft] = useState(property.review_settings);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const presets = useQuery({
    queryKey: ["presets"],
    queryFn: () => api<Preset[]>("presets/"),
  });
  async function save() {
    setBusy(true);
    setError("");
    try {
      await write(`properties/${property.id}/settings/`, draft, "PATCH");
      await query.invalidateQueries({ queryKey: ["gallery", property.id] });
      await query.invalidateQueries({ queryKey: ["photo"] });
      await query.invalidateQueries({ queryKey: ["properties"] });
      setNotice("Gallery settings saved.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-scroll">
      <label>
        Presets
        <select
          aria-label="Settings preset"
          defaultValue=""
          onChange={(e) => {
            const p = presets.data?.find((p) => p.id === e.target.value);
            if (p) setDraft(p.config);
          }}
        >
          <option value="" disabled>
            Choose a preset
          </option>
          {presets.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.standard ? "" : " · Custom"}
            </option>
          ))}
        </select>
      </label>
      {sections.map(([heading, items]) => (
        <section key={heading}>
          <h3>{heading}</h3>
          {items.map(([key, label]) => (
            <label className="setting-row" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={label}
                checked={draft[key]}
                disabled={
                  busy || (key === "watermark" && property.watermark_locked)
                }
                onChange={(e) =>
                  setDraft({ ...draft, [key]: e.target.checked })
                }
              />
            </label>
          ))}
        </section>
      ))}
      {property.watermark_locked && (
        <p className="caption">
          Older proofs have permanent watermarks. They cannot be switched off;
          newly uploaded review copies support both options.
        </p>
      )}
      <details>
        <summary>Customize asset statuses</summary>
        {["approved", "rejected", "review", "in_progress"].map((s) => (
          <label className="setting-row" key={s}>
            <span>{s.replaceAll("_", " ")}</span>
            <input
              type="checkbox"
              checked={draft.allowed_statuses.includes(s)}
              disabled={s === "approved"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  allowed_statuses: e.target.checked
                    ? [...draft.allowed_statuses, s]
                    : draft.allowed_statuses.filter((x) => x !== s),
                })
              }
            />
          </label>
        ))}
      </details>
      <details>
        <summary>Customize color labels</summary>
        {draft.labels.map((label, i) => (
          <div className="label-setting" key={label.id}>
            <span style={{ background: label.color }} />
            <input
              aria-label={`${label.id} label name`}
              value={label.name}
              maxLength={30}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  labels: draft.labels.map((x, n) =>
                    n === i ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
            />
            <input
              type="checkbox"
              aria-label={`Enable ${label.id} label`}
              checked={label.enabled}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  labels: draft.labels.map((x, n) =>
                    n === i ? { ...x, enabled: e.target.checked } : x,
                  ),
                })
              }
            />
          </div>
        ))}
      </details>
      <p className="caption">
        Downloads contain resized review copies only. Full-quality delivery
        stays separate.
      </p>
      {(error || presets.error) && (
        <ErrorNotice error={error || message(presets.error)} />
      )}
      {notice && <p role="status">{notice}</p>}
      <Button disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save gallery settings"}
      </Button>
      <div className="preset-save">
        <input
          aria-label="Preset name"
          placeholder="Name your preset"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await write("presets/", { name, config: draft });
              await query.invalidateQueries({ queryKey: ["presets"] });
              setName("");
              setNotice("Custom preset saved.");
            } catch (e) {
              setError(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save preset
        </Button>
      </div>
    </div>
  );
}
