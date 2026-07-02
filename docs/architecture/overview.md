# Architecture Overview

BagDrop is a static, browser-only ROS 2 bag triage application.

The product boundary is intentionally narrow: a user drops a bag, BagDrop returns an overview, findings, health signals, and exportable reports. It is not a general visualization workspace.

## Layers

1. TypeScript UI and Browser Bridge
   - Drag and drop, File and Directory APIs, OPFS, Worker lifecycle, rendering, PWA, and local export.
   - TypeScript should not own CDR parsing, topic health rules, GNSS interpretation, or health scoring.

2. Official SQLite Wasm
   - SQLite file format, B-tree access, SQL execution, schema introspection, and integrity behavior.
   - Initial storage target is rosbag2 SQLite `.db3`.

3. MoonBit Analysis Core Wasm
   - ROS schema IR, CDR decoding, field projection, streaming statistics, downsampling, diagnostics, health scoring, plugin contract, and result serialization.
   - MVP should use classic Wasm with a pointer/length ABI.

## Initial Flow

```text
Drop
  -> file inventory
  -> WAL/journal/incomplete-state detection
  -> SQLite capability detection
  -> topic catalog scan
  -> plugin probe and analysis plan
  -> selected topic/field streaming scan
  -> MoonBit online analysis
  -> ResultBundle
  -> declarative UI and local report export
```

## Feasibility Gate

The first hard technical gate is a read-only DirectFileVFS:

```text
SQLite xRead(offset, length)
  -> File.slice(offset, offset + length)
  -> FileReaderSync.readAsArrayBuffer()
  -> copy into SQLite Wasm memory
```

This avoids loading multi-GB bags into memory and avoids copying every run into OPFS. OPFS remains the fallback for browsers where Worker `FileReaderSync` or the custom VFS path is unavailable.

## Current Catalog Implementation

The Worker catalog uses `@sqlite.org/sqlite-wasm` with three read paths:

1. **DirectFileVFS (preferred)** — When the bag Worker has `FileReaderSync`, SQLite reads bag bytes through `File.slice()` without loading the whole `.db3` into memory. This is the large-bag path.
2. **OPFS staging** — When DirectFileVFS is unavailable but SQLite OPFS is available, large `.db3` files are copied into OPFS in chunks via `OpfsDb.importDb()` and scanned from there. Staged files are removed after the catalog scan completes, and stale staging files are cleaned at Worker startup.
3. **Deserialize fallback** — When DirectFileVFS is unavailable and the file fits in memory, small `.db3` files are copied with `sqlite3_deserialize()`.

The deserialize fallback is capped at 64 MiB per `.db3`. Files above that cap fall back to OPFS staging when available, otherwise they are reported as deferred.

Browser coverage lives in `apps/web/tests/direct_file_vfs_smoke.mjs` (DirectFileVFS path) and `apps/web/tests/opfs_staging_smoke.mjs` (OPFS staging path via `?bagdrop_test=opfs`).

## Current Stream Analysis

After a ready SQLite catalog is produced, the bag Worker runs a lightweight stream scan:

1. Re-open each scanned `.db3` segment through the same readonly storage paths as catalog.
2. Stream `messages.timestamp`, payload size, and base64-encoded payload bytes in fixed batches.
3. Verify streamed counts against catalog aggregates, compute `maxGapNs` and refined `meanRateHz`, decode known CDR types, and emit findings for mismatches, large gaps, or decode failures.
4. Emit columnar `TopicMessageBatch` objects and feed them to MoonBit `core_consume_batch()` through a JSON batch codec. The Worker prefers `apps/web/public/moon/core.wasm`, falls back to `core.stub.wasm`, then to a TypeScript backend. MoonBit returns topic stats, per-topic status, and findings such as stream count mismatches and large timestamp gaps.
