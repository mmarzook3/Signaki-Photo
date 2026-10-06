# Unresolved feedback

The gallery includes an **Unresolved feedback** filter. Its count is the number of
visible photos or videos with at least one unresolved comment, not the number of
comments. Each matching card also shows its unresolved comment count.

Comments remain separate from review decisions: adding a comment does not mark an
item as Changes needed or revoke approval. Unresolved comments on older versions
remain discoverable until resolved. Users who cannot access earlier versions only
receive counts for their visible latest version; comments-disabled users receive
zero counts. Existing ownership and hidden-media rules apply.

The filter uses `?status=unresolved`, survives refresh and is preserved through viewer
navigation. Opening a result automatically opens its feedback panel. Resolving or
reopening a thread invalidates the gallery query and updates the filter count.
Filename and room filters continue to work with this filter.

No database migration or existing-record updates are required. The API prefetches
unresolved comment identifiers in bulk, without loading comment text into gallery
responses or issuing queries for each media item.

Verified on 6 October 2026: 13 backend collaboration/filter tests, six frontend tests,
TypeScript build and ESLint. Staging browser checks covered old-version comments,
approved items with open feedback, refresh persistence, opening the feedback panel,
resolution/count refresh, and mobile overflow. Public production checks were read-only.
The deployment's before/after customer-record and media audit was identical.

Application release: `f12d88ddf268`. Prior image: `f88638c92736`; existing deployment
rollback procedures apply, with no schema changes to reverse.

## Revised media

The separate Revised media filter (`?status=revised`) shows visible items whose latest version number is greater than one. It finds actual replacement uploads independently of resolved comments or approval state, and includes both photos and videos. Filename search and viewer/back navigation preserve the filter.

Release `008966adb8c6`, 6 October 2026: seven frontend tests, build and lint passed; staging browser checks covered filter count, refresh persistence and version/back navigation. Production read-only verification passed; before/after persistent-data audit was identical. No schema changes.
