# SQLite Wasm

The web app currently consumes `@sqlite.org/sqlite-wasm` through pnpm:

- Version: `3.53.0-build1`
- Lockfile: `pnpm-lock.yaml`
- Notice: `THIRD_PARTY_NOTICES.md`

The Worker catalog prefers a read-only DirectFileVFS backed by `File.slice()` and `FileReaderSync`. That path avoids whole-file reads for large `.db3` files.

When DirectFileVFS is unavailable, the catalog falls back to OPFS staging for large `.db3` files and to small-file in-memory deserialization capped at 64 MiB. OPFS staging copies the bag into SQLite Wasm's OPFS-backed VFS in chunks, scans it, and removes the staged copy when the scan finishes.
