# Viewer redesign — approved and deployed

Deployed application: `d5a5220678e9`. Previous release: `dc89b3fe6525`.
The user approved the staging visuals on 5 October 2026 before promotion.

## Design

Black photo canvas; feedback and thumbnails are optional rather than permanent.
Primary controls use a consistent 50px pill scale (43px on mobile). Status, labels,
versions and viewer options use accessible Radix menus with keyboard navigation,
focus restoration and viewport collision handling. Drawing mode replaces the
review toolbar with colour and shape controls. No Picflow assets or source are used.

Finishing a stroke opens a white comment card beside its endpoint. Closing the
card preserves the draft and leaves a resumable marker. Sending persists the
version-bound geometry and comment; clicking the saved avatar marker reopens its
conversation and replies. The card's position follows normalized coordinates,
zoom and pan, with viewport bounds. Comments also remain available in the feedback
sidebar. Administrators can resolve/reopen a conversation directly on the photo.

The existing backend, ownership checks, gallery presets, customer accounts,
version history and delivery configuration are retained. The only server change
adds the four drawing palette colours to validation while accepting old colours.
No schema or production data changes are required by this candidate.

## Modules

- `ViewerMenu`: reusable accessible menus.
- `DrawingToolbar`: drawing mode tools and palette.
- `AnchoredConversation`: on-photo composer, saved thread, replies and resolution.
- `ImageStage`: image geometry, zoom/pan and annotation anchors.
- `viewer.css`: scoped visual system; existing gallery styling remains separate.

## Verification

Nine staging browser journeys passed, covering drawing coordinates at 125% zoom,
menus, comment creation/replies/reopening after reload, mobile bounds, settings,
presets, downloads/uploads, view-only restrictions and existing administration.
Browser tests check runtime/console errors. Five frontend unit tests, TypeScript,
ESLint, production build and 11 relevant backend collaboration tests passed.
The visual journey was additionally captured at the reference's 1407×1256 viewport
and 390×844 mobile viewport using the same flower photograph as the supplied image.

Captured screenshots are private ignored artifacts under
`output/viewer-redesign-2026-10-05/`, including an HTML contact sheet. Customer photos
and test credentials are not committed. QA writes occurred only in staging.

## Review and next step

Review the canvas, menus, drawing mode, anchored composer, saved conversation and
mobile screenshot. This is a viewer redesign, not a claim of exact Picflow parity.
The screenshot's private-comment lock and emoji picker have not been added as
decorative, nonfunctional controls. The existing supported status choices remain.
Gallery and settings visual redesigns remain a subsequent step.

After visual approval, rerun the release gate and promote the exact staged image
with the existing backup/audit procedure. The source has been committed in separate
implementation, repair and styling milestones. No production cutover was performed
for this staging review.


## Production verification — 5 October 2026

The exact approved staging image was promoted. No database migrations were needed.
The promotion audit matched original customer records and proof bytes before and
 after cutover. Public HTTPS health, the application shell and script assets passed;
anonymous gallery API access remained denied. The existing nine passing staging
browser journeys cover the signed-in interaction changes.

Release record: `20261004T232726Z` (UTC identifier). Previous image is retained for
rollback. Post-release encrypted backup `photo-scanaki-20261004T232730Z.tar.gz.age`
was copied off-host, decrypted successfully and its SQLite integrity verified
(206 photos). Idle memory observed: approximately 93 MiB of the 768 MiB limit.
Staging was stopped after promotion. No shared routing or unrelated services changed.
