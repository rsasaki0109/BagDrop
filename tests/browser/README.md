# Browser Tests

Browser tests should cover offline operation, no bag-byte upload, large-file workflow behavior, and UI rendering.

Implemented in `apps/web/tests/`:

- `direct_file_vfs_smoke.mjs` — default Worker storage path (DirectFileVFS when available)
- `opfs_staging_smoke.mjs` — forces OPFS staging via `?bagdrop_test=opfs` (uses real OPFS when the browser supports sync OPFS handles; otherwise exercises the OPFS routing path with an in-memory stand-in)
