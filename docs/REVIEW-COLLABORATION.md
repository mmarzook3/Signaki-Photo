# Review collaboration

The gallery header's **Gallery settings** button opens the administrator controls.
The same controls are available from the viewer toolbar. Property ownership and
delivery configuration remain in **Property settings**.

## Customer workflow

- Open a photograph, select a version, and use the heart to save a personal favourite.
- Use the status menu or feedback panel to approve, reject, request changes or mark
  an edit in progress. Reject and Review require a reason. Decisions remain attached
  to the selected version; replacement uploads start awaiting review.
- Apply one of five colour labels. Administrators can rename or disable labels.
- Comment, reply to a comment, or draw pins, freehand strokes, rectangles, ellipses
  and arrows. Add a description and send the comment to persist the drawing. Undo
  and Clear affect unsent drawings only. Geometry is stored in normalized image
  coordinates and follows zoom, pan and viewport resizing.
- Gallery status applies to the collection as a whole. Gallery activity shows its
  decision history and required reasons separately from photo decisions.

## Settings and presets

Switches govern gallery status, asset status, favourites, comments, annotations,
colour labels, downloads, customer uploads, file information, workflow filters,
version history and watermarks. View-only overrides collaboration and upload
permissions. Administrators retain management access. Capabilities are checked
on the server, including direct requests and legacy review routes.

Standard presets: View-Only, Download, Review and Workflow. Selecting a preset
changes the form; **Save gallery settings** applies it. Save Preset stores the
current configuration under a unique name for reuse across properties.

Existing galleries keep downloads and customer uploads disabled, with watermarks
enabled. No customer credentials, original photos, existing decisions or delivery
links are changed by the migration. Workflow access controls the advanced gallery
filter interface; it does not grant access to another customer's collection.

## Review-copy safeguards

Only resized JPEG review derivatives are stored (1280px and 480px maximum edge,
quality 72, stripped metadata). New uploads produce watermarked and clean review
derivatives. Originals are discarded. Clean derivatives stay private and are served
only when the property's watermark setting is disabled. Downloads are permission
checked review copies, optionally restricted to approved versions. High-resolution
delivery continues through the separately released delivery link.

Legacy proofs have watermarks baked into the image. Galleries containing those
versions cannot switch watermarks off: uploading replacements does not remove the
legacy versions. The UI explains this limitation. This release does not attempt to
reconstruct clean originals or make screenshots impossible.

## Architecture and limits

- `proofs/features.py`: defaults, presets, validation and capability rules.
- `proofs/annotations.py`: bounded geometry validation (8 shapes/comment,
  500 points/freehand stroke, finite coordinates between 0 and 1).
- `proofs/api/collaboration.py`: scoped favourites, labels, settings, gallery
  decisions, metadata and downloads. Comment endpoints persist drawings/replies.
- `frontend/src/modules/review`: modular settings, decisions, toolbar and SVG
  annotation components; no copied third-party application source.
- `frontend/openapi.yaml` and generated TypeScript contracts describe the API.
- Migrations 0004–0006 are additive. Database defaults allow older application inserts after a rollback. Gallery decision history returns the most
  recent 100 entries. Replies support one level and must belong to the same version.
- Existing revision and request UUID checks prevent stale decisions and duplicate
  comments on retries. Favourites have a unique user/photo constraint.

## Verification and operation

Backend coverage includes ownership, view-only overrides, individual capabilities,
disabled versions, legacy route bypasses, required reasons, stale revisions,
annotation limits, retry deduplication, reply ownership, watermark selection,
download restrictions and customer uploads. Browser coverage runs against isolated
staging fixtures and covers the new tools plus the existing review/provisioning flows.

Run Django tests with isolated test settings; frontend checks are `npm run lint`,
`npm run build`, `npm test` and `npm run test:e2e`. E2E requires a private
`SIGNAKI_QA_FILE` and `SIGNAKI_TEST_URL` pointing to staging. Never supply customer
credentials or run mutation tests against production.

Deployment follows `docs/OPERATIONS.md`: build on the authorized laptop only,
verify staging, make an encrypted backup, then promote the exact image. Data audit
excludes newly added fields when comparing old/new schemas, but preserves checks
of all original customer records and proof bytes. Additive defaults are checked
separately. Keep the previous image for rollback; do not reverse migrations or
delete new feedback during rollback. Restore an encrypted backup only for an
explicitly approved data recovery, since it discards changes made after that backup.
