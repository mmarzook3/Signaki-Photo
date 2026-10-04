import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, ArrowUpRight, Search, FolderOpen } from "lucide-react";
import { api, message } from "@/api/client";
import type { Property } from "@/api/types";
import { useUser } from "@/modules/session/Session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, ErrorNotice, Empty } from "@/components/common";
import { PropertyEditor } from "./PropertyEditor";
export function DeliveryLink({ property }: { property: Property }) {
  return property.delivery_shared && property.delivery_url ? (
    <a
      className="delivery-link"
      href={property.delivery_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      High-quality photos
      <ArrowUpRight size={15} />
    </a>
  ) : null;
}
export function Dashboard() {
  const user = useUser();
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState(false);
  const result = useQuery({
    queryKey: ["properties"],
    queryFn: () => api<Property[]>("properties/"),
  });
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorNotice error={message(result.error)} />;
  const items = result.data.filter((p) =>
    `${p.name} ${p.address}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {user.is_staff ? "STUDIO LIBRARY" : "SHARED WITH YOU"}
          </p>
          <h1>Your properties</h1>
          <p className="muted">
            Every photograph. Every detail. All in one place.
          </p>
        </div>
        {user.is_staff && (
          <Button onClick={() => setEdit(true)}>
            <Plus size={16} />
            Add property
          </Button>
        )}
      </div>
      <div className="dashboard-toolbar">
        <span className="section-label">
          <FolderOpen size={17} />
          All properties <span className="count">{items.length}</span>
        </span>
        <div className="search-field">
          <Search size={16} />
          <Input
            aria-label="Search properties"
            placeholder="Search properties…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="property-grid">
        {items.map((p) => (
          <article className="property-card" key={p.id}>
            <Link
              to="/app/properties/$propertyId"
              params={{ propertyId: p.id }}
            >
              <div className="property-cover">
                {p.cover ? (
                  <img src={p.cover.thumb_url} alt={p.name} />
                ) : (
                  <ImagesPlaceholder />
                )}
                <span className="property-overlay">
                  {p.archived ? "Archived" : `${p.photo_count} photographs`}
                </span>
              </div>
              <div className="property-caption">
                <h2>{p.name}</h2>
                <ArrowUpRight size={18} />
              </div>
              <p className="caption">
                {p.address ||
                  (user.is_staff
                    ? p.customer.username
                    : "Private photo collection")}
              </p>
              <div className="card-progress">
                <progress
                  value={p.reviewed_count}
                  max={Math.max(p.photo_count, 1)}
                />
                <span>
                  {p.reviewed_count}/{p.photo_count} reviewed
                </span>
              </div>
            </Link>
            <DeliveryLink property={p} />
          </article>
        ))}
      </div>
      {!items.length && (
        <Empty
          title="No properties here yet"
          text={
            search
              ? "Try a different search."
              : "Your property galleries will appear here."
          }
        />
      )}
      {user.is_staff && <PropertyEditor open={edit} onOpenChange={setEdit} />}
    </>
  );
}
function ImagesPlaceholder() {
  return (
    <div className="cover-placeholder">
      <FolderOpen size={38} />
      <span>Photos coming soon</span>
    </div>
  );
}
