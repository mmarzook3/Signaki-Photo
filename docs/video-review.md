# Video review

Videos share the existing property, group, review status, favourites, labels and
version history. The internal `Photo` name is retained for backwards compatibility.
Existing photos and URLs do not change. Migration 0007 adds nullable/defaulted fields.

## Upload and review

Use **Add photos or videos**, choose a group and upload MP4, MOV, M4V or WebM.
Each video must be at most 250 MB and five minutes; a request totals at most 250 MB.
Photos retain their 25 MB limit. The queue accepts at most 20 unfinished videos.
Use a compressed delivery export rather than a large camera original.

Queued items show a placeholder and refresh automatically. A separate, single
`video-worker` Compose service creates H.264/AAC previews bounded to 1280×720
(720×1280 portrait), with repeated burned-in watermarks and a filename/version strip.
Video watermarks stay enabled even if photograph watermarking is switched off.
Original uploads are private temporary files and are removed after conversion or
failure. No endpoint serves sources. Backups can retain temporary sources captured
while a job was pending, under the existing encrypted retention policy.

Open a video, pause at the desired moment, click **Comment**, and send feedback.
The timestamp and version are stored together. Clicking the timestamp seeks to that
moment, including an earlier version. Replies inherit the thread timestamp.
Approve/reject/request changes work as for photos; reject/review require a reason.
Replacement uploads must retain the original media type. Draw and simultaneous
version comparison remain photo features; videos use timestamped discussion.

## Operations

Install FFmpeg in the application image. Run exactly one `process_videos` worker per
deployment, sharing only that deployment's private data volume. It uses one CPU and
768 MB maximum. Conversion occurs outside database transactions. Interrupted jobs
are requeued when the worker starts; failed jobs show an actionable error and can
be replaced. Each FFmpeg step has a 15-minute timeout and uses one encoding thread.
Upload temporary files live on the data disk rather than the 128 MB memory tmpfs.

The dedicated HTTPS route needs `client_max_body_size 256m`. Media requests retain
session, customer, hidden-property and version permissions, including byte-range
seeking. Displayed previews can still be captured; high-quality sources are never
offered as playback or downloads. The existing download permission only releases
the watermarked video preview.

Before deployment take the existing encrypted backup, test migration and conversion
in isolated staging, and use `ops/promote.py` on the authorised Linux host. The
promotion audit ignores newly defaulted schema fields while preserving hashes of
existing records and includes both JPEG and MP4 derivatives. Stop the worker before
rolling back to an older application image which lacks the worker command. The
additive migration can remain while rolling back application code.

Automated regression coverage: valid and invalid uploads, actual FFmpeg conversion,
temporary-source deletion, byte ranges, customer isolation, timestamp validation,
idempotent comments and feedback preservation across replacement versions.

## Release verification — 5 October 2026

Deployed application revision: `f88638c92736` at https://photo.signaki.com.
The implementation was committed separately from viewer refinements.

- 48 backend tests passed locally and in the isolated Linux staging image.
- Five frontend tests, TypeScript/build and ESLint passed.
- Browser checks passed for portrait and landscape playback, actual file upload,
  replacement upload, earlier-version selection, timestamped comments, timestamp
  seeking and mobile layout. No browser console errors in the production check.
- An isolated production fixture passed HTTPS upload, background conversion,
  authenticated partial-content playback, anonymous denial, timestamp comments,
  and mandatory reasons for requests for changes. The fixture and its sessions
  were removed afterwards. No client videos were added as part of this release.
- Promotion preserved the existing 53 photos, 53 versions and 212 derivatives;
  the existing customer-record/media audit was identical before and after release.
- Encrypted backups were copied off-host, hash checked, decrypted in isolation,
  and checked for SQLite integrity and every referenced media file. The backup
  helper pauses only the dedicated video worker during its snapshot and resumes it;
  running/unpaused state was verified after backup.
- Observed idle memory: web approximately 109 MiB, worker 48 MiB. The worker has
  a 768 MiB / one-CPU cap. Staging was stopped after validation.

Not tested: shared-host reboot, sustained concurrent uploads, long-duration load
or disk-full recovery. These are not claimed by the smoke tests above.
