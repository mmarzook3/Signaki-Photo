# Signaki Photos

A private property-photography review workspace with a modular React/TypeScript
frontend and Django API. The application is self-hostable and uses open-source
libraries. Reference-product assets and customer data are not included.

## Current scope

- Customer accounts and assigned properties; staff administration.
- Watermarked galleries, room groups, filename/status filters and review progress.
- Immersive viewer, zoom/pan, previous/next, keyboard navigation and comparison.
- Immutable photo versions, version-specific comments and customer decisions.
- Mandatory reasons for Reject and Review; approval is separate from resolution.
- Upload/replacement, hidden photos, archived properties and customer access controls.
- Admin-controlled Google Drive delivery link on property cards and property pages.

The later P7 features (annotations, threaded/private comments, Kanban, integrations,
notifications and paid checkout) are intentionally not included in this release.

## Development

Use Python 3.12 and Node 24.15. Set a private `DJANGO_SECRET_KEY`, an isolated
`DATA_DIR`, `COOKIE_SECURE=0`, `SSL_REDIRECT=0` and `NEW_UI_ENABLED=1` for local tests.
Never point development commands at production data.

```text
python -m venv .venv
python -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py runserver 127.0.0.1:8000
```

Open `/app/`. Frontend assets are served by Django/WhiteNoise at the same origin;
no separate Node runtime is needed in production. `/` redirects to the new UI when
`NEW_UI_ENABLED=1`. Legacy bookmarks bridge to corresponding new screens.

## Checks

```text
python manage.py test proofs
python manage.py spectacular --file frontend/openapi.yaml --fail-on-warn
cd frontend
npx openapi-typescript openapi.yaml -o src/api/generated.ts
npm run typecheck
npm run lint
npm test
npm run build
npm run build-storybook
npm run test:e2e
```

Browser tests require `SIGNAKI_TEST_URL` and `SIGNAKI_QA_FILE` pointing to isolated
QA credentials and fixture IDs. Do not use production credentials in browser tests.
The fixture file has username, password, property, photo and optional upload path.
It stays outside Git. Tests use the installed Chrome browser in an isolated context.

## Architecture and operations

See [architecture](docs/ARCHITECTURE.md), [operations](docs/OPERATIONS.md) and
[third-party notices](THIRD_PARTY_NOTICES.md). The public repository deliberately
excludes private host/key configuration, databases, photographs, credentials,
reference captures and test artifacts.

For this deployment, Docker runs only on the authorised spare laptop. Never run or
inspect Docker on the administration PC. Source bundles include tracked files only.

## Review-image protection

Uploads become 1280px review JPEGs and 480px thumbnails. Repeated watermarks and
filename/version labels are rasterised; source metadata is removed and originals
are discarded. Each proof request checks access. Screenshots cannot be prevented.
Keep full-quality originals separately and release the delivery link deliberately.

Input limits: JPEG/PNG/static WebP, 25 MB and 40 megapixels per image, ten files and
64 MB per request. Videos/RAW hosting are not supported. Drive sharing permissions
remain managed in Drive; hiding a portal link does not revoke Drive access.
