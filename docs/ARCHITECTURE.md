# Signaki review workspace

The frontend is an original React/TypeScript application informed by the reference
workflow. It does not contain Picflow bundles, fonts, screenshots or customer data.

## Modules

- `app`: typed routing, authentication boundary and workspace shell.
- `components/ui`: shadcn/Radix primitives; shared tokens live in `styles.css`.
- `modules/gallery`: room disclosures, query filters and review counts.
- `modules/viewer`: contained images, zoom/pan, comparison and scoped navigation.
- `modules/feedback`: version-specific decisions, required reasons and draft state.
- `modules/uploads`: validated uploads, per-file results and lazy success animation.
- `modules/properties`, `customers`, `session`: administration and account controls.
- `api`: CSRF-aware same-origin requests and generated OpenAPI response types.

Django remains authoritative for sessions, ownership, validation and persistence.
No access token is stored in localStorage. Query owns server state; Zustand holds
only transient drafts and room disclosure preferences. The router preserves filter
and version identity. A browser-close warning protects unsent text.

The legacy server-rendered UI remains available for rollback. `NEW_UI_ENABLED=1`
selects the new application at `/app/` and makes the site root redirect there.
The migration is additive: request IDs and review revision counters only. Existing
photo, group, customer, version and comment IDs remain unchanged.

## Security boundaries

Every API media and resource lookup checks property access. Hidden and archived
objects remain inaccessible to customers. Unreleased Drive URLs are omitted from
customer output. Staff cannot submit decisions as a customer. Reject/review require
a reason. Decisions use a revision counter; comments and replacement uploads have
retry identifiers. Comment resolution never implies approval.

CSP keeps scripts self-only and blocks eval. `style-src-attr 'unsafe-inline'` is
limited to style attributes required by accessible popover positioning and image
transforms; style elements remain self-only. The Lottie light player is used to
avoid expression eval. The checkmark animation is original and loaded on success.

Phase P7 is not implemented: freehand/pin annotations, new threaded comments,
Kanban, integrations, email notifications and paid delivery remain out of scope.
