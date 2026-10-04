# Deployment and rollback

Docker is run on the authorised remote laptop only. The administration PC is used
for source editing, tests and SSH. Host-specific keys, paths and private runbooks
are not part of this public repository.

Production uses a dedicated loopback ingress behind the existing encrypted tunnel
and shared HTTPS gateway. Do not publish databases, alter unrelated routes, prune
Docker globally, reset WSL or reboot a shared machine as part of this release.

## Build

`Dockerfile` builds the locked frontend dependencies in a Node stage, then copies
the static result into the Python image. No Node server runs in production.
`ops/source_bundle.py` packages tracked source only and rejects sensitive paths.

## Staging

`ops/compose.staging.yaml` uses a separate data directory, network, secrets, memory
limit and loopback port. Verify the port and physical disk space before use. Review
it over SSH forwarding; no public staging hostname is required. Use isolated QA
accounts. Never change production user passwords for a test.

## Release gate

1. Run backend, unit, browser, type, lint and build checks.
2. Take a consistent encrypted backup and verify its off-host copy.
3. Rehearse additive migrations on an isolated copy and compare existing records
   and proof-file hashes. Rehearse application rollback there.
4. Deploy the exact staged image, preserving the previous image and environment.
5. Apply migrations and enable the new UI. Verify public HTTPS and access controls.
6. Confirm production record counts and original proof hashes, then back up again.

Rollback should first switch to the previous image with `NEW_UI_ENABLED=0` while
retaining the additive schema. Never overwrite new feedback with an old database
backup. A full restoration requires a write pause and data reconciliation.

Retain host-managed startup, TLS renewal and encrypted backup schedules. Reboot,
long-duration load and disaster recovery must be labelled unverified unless run.
