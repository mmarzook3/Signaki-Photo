# Signaki Photos

Private property-photo reviews at **https://photo.signaki.com**. This domain was
confirmed by the owner; the originally supplied photo.scanaki.com was a domain mix-up.

## Using the platform

1. Sign in as administrator and change the temporary password at first login.
2. In **Customers**, create a username and temporary password. Share them privately.
   Customers must choose a new password at first login.
3. **Add property**, enter its name/address, and assign the customer.
4. Open the property, expand **Add photographs**, create room groups and upload up
   to ten JPEG/PNG/WebP files at a time. Select their group during upload.
5. Customers switch between **All photos** and **By room / group**.
6. Select a photo to comment. Every comment records the exact version. The latest
   photo opens by default; the version selector preserves earlier images.
7. Administrators use **Feedback** across properties, open the referenced version,
   upload a replacement, reply and mark comments resolved.
8. Photo settings change group, order and visibility. Property settings archive or
   reassign properties. Customer access can be disabled and passwords reset.

## Image protection and limits

Only 1280px review JPEGs and 480px thumbnails, quality 72, are stored. Source uploads
are discarded; source EXIF is stripped. Repeated watermarks plus photo name/version
are baked into both image sizes, not removable HTML overlays. Every image request
checks customer/property access; there is no public media folder or open registration.

Screenshots and saving displayed watermarked proofs cannot be prevented. Watermarks
are a deterrent, not DRM. Keep full-quality originals in your separate photography
storage and deliver them outside this app after payment.

Maximum 25 MB / 40 megapixels per input, ten files per upload, 64 MB request limit.
JPEG, PNG and static WebP only. Videos, RAWs and unwatermarked master downloads are
not supported. Existing versions keep their embedded names if a photo is renamed;
new versions use the new name. Comments retain their original version association.
No email, payment, external integration or automatic messaging is enabled.

## Implementation and local testing

Django 5.2 LTS, Gunicorn, Pillow, WhiteNoise, SQLite WAL and server-rendered templates.
Small progressive-enhancement JavaScript; no front-end build or external font/CDN.
Password hashing, CSRF protection, secure HttpOnly cookies, login throttling, CSP
and property-level authorisation are enabled. Migrations are committed; versions
create immutable proof files instead of overwriting prior images.

On the main PC use Python only, never Docker. Create `.venv`, install
`requirements.txt`, set a local-only `DJANGO_SECRET_KEY`, `COOKIE_SECURE=0` and
`SSL_REDIRECT=0`, then run:

```powershell
.venv\Scripts\python.exe manage.py migrate
.venv\Scripts\python.exe manage.py collectstatic --noinput
.venv\Scripts\python.exe manage.py test proofs
.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Production Docker operations run remotely on HASHIK only. See [deployment](DEPLOYMENT.md)
and [test evidence](TESTING.md).


Gallery update: photo pages offer Previous/Next and a position counter. Grouped navigation stays within the selected room; All photos follows property order. Hidden photos remain excluded for customers. Room groups use accessible native disclosure controls and start collapsed. Navigation boundaries and grouping are covered by regression tests.

Customer decisions are version-specific: Approve needs no comment; Reject (not needed) and Review (changes needed) require a reason. Decisions remain in feedback history, and new versions await review. Admins add an HTTPS Google Drive URL in Property settings and enable Share delivery link with customer when delivery is ready. The link then appears on the property card and gallery. Drive sharing permissions must allow the customer access.


2026-10-04 workspace redesign: compact sidebar, responsive gallery, filename search, latest-version status filters, review progress and compact grid. The viewer adds a nearby-photo filmstrip, left/right keyboard navigation (disabled while typing), full screen where supported, and comparison against another version. Existing authentication, version-specific decisions/comments, grouping, uploads and delivery controls are retained. Browser checks on an isolated 12-photo fixture passed at 1440px and 390px: filtering, disclosures, comparison, mandatory reason, decision persistence, navigation and overflow. No customer feedback was changed for tests. This is an original Signaki interface informed by public Picflow references; it does not claim the full Picflow product or integrations.
