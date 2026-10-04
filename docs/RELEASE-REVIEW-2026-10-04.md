# Collaboration release — 4 October 2026

Deployed application: `dc89b3fe6525`. Previous application: `a45ee01ed2ef`.
Public application: https://photo.signaki.com/app/

## Delivered

Version selection and comparison, personal favourites, version-specific decisions,
customizable colour labels, comments and threaded replies, five annotation tools,
file information and permission-controlled review downloads. Gallery settings
provide the requested collaboration/access switches, four standard presets and
saved custom presets. Gallery decisions have an administrator-visible history.
Customer uploads can be enabled per property. Existing delivery links and roles
remain unchanged. See [the user and technical guide](REVIEW-COLLABORATION.md).

This releases the requested collaboration subset previously deferred with P7.
Kanban, private/internal comment channels, notifications, integrations, paid delivery
and general Picflow feature parity remain outside this release.

## Verified

- 45 Django tests passed inside the staging image.
- Five frontend unit tests, TypeScript, ESLint and production build passed.
- OpenAPI schema validated and frontend contracts regenerated.
- Nine browser journeys passed against private staging, with no browser runtime
  or console errors: all five drawing tools at 125% zoom with coordinate checks;
  favourites/labels/annotations/replies; settings and custom presets; customer
  download/upload/gallery decisions; view-only restrictions; existing review
  navigation/drafts/decisions; mobile layout; admin delivery/replacement/resolution;
  and customer provisioning/password change.
- Desktop and mobile screenshots were visually reviewed. Oversized dropdowns,
  sidebar scrolling and native selection interrupting drawing were corrected.
- The previous production image successfully read and inserted into the migrated
  staging database using the legacy UI, with all test writes rolled back.
- Public HTTPS health, application shell, CSP and anonymous access restrictions
  passed. Production authenticated API views and cross-customer isolation passed
  read-only checks. Live sign-in browser journeys were tested in staging; production
  customer passwords and profile flags were preserved.
- Before/after/final audits matched all original customer records and proof bytes:
  206 photos, 211 versions, 13 groups and 422 proof JPEGs.
- Pre-release and post-release encrypted offsite backups were downloaded, decrypted,
  SQLite integrity checked and proof hashes matched. The post-release archive
  contains all six migrations.

## Operations

The existing laptop Docker host, private ingress, encrypted tunnel and VPS gateway
were reused. Production remains on loopback port 18120 with a 768 MiB limit.
Observed post-release container memory was approximately 107 MiB at idle; this is
not a load/capacity guarantee. No Docker operations ran on the administration PC.
Staging on loopback 18125 was stopped after verification. Unrelated services,
gateway routing, TLS renewal and startup tasks were unchanged.

Release record: `20261004T222811Z` in the production project's `release-records`.
Verified post-release archive: `photo-scanaki-20261004T222859Z.tar.gz.age`.
SHA-256: `e862971a41e687b1274261065dd6271ce6e260d049ee3cc81b353cadabff1d39`.

For rollback, select the previous image and `NEW_UI_ENABLED=0`, retaining the
additive schema. Database defaults preserve old insert compatibility. Do not
restore an older database over new customer feedback. Follow
[operations](OPERATIONS.md) for recovery.

## Limits

Existing raster-watermarked versions cannot be unwatermarked. Their gallery
watermark switch is locked; newly uploaded galleries support both derivative
variants. Downloads remain resized review copies, not original/full-resolution
delivery. Screenshots cannot be made impossible. Host reboot recovery, prolonged
load and exhaustive accessibility/device coverage were not tested in this release.
