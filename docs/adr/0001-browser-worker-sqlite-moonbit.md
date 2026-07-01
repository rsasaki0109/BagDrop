# ADR 0001: Browser Worker, SQLite Wasm, and MoonBit Core Boundary

Status: Accepted

## Context

BagDrop must run from static hosting, keep bag data local, support large `.db3` files, and keep deterministic analysis reusable outside the UI.

Reimplementing SQLite in MoonBit would move complexity away from BagDrop's actual value. Browser APIs also do not belong in the analysis core.

## Decision

Use three boundaries:

- TypeScript owns browser APIs, Worker orchestration, VFS plumbing, UI, PWA, and export.
- Official SQLite Wasm owns database access and schema introspection.
- MoonBit classic Wasm owns CDR decoding, statistics, diagnostics, health scoring, and plugin execution contracts.

The MoonBit ABI uses numeric handles and pointer/length buffers:

```text
core_create(config_ptr, config_len) -> handle
core_register_topic(handle, topic_ptr, topic_len) -> status
core_consume_batch(handle, batch_ptr, batch_len) -> status
core_finish(handle) -> result_handle
core_result_ptr(result_handle) -> ptr
core_result_len(result_handle) -> len
core_free_result(result_handle)
core_destroy(handle)
```

## Consequences

- The first MVP can run on GitHub Pages without a backend.
- SQLite compatibility follows official SQLite Wasm instead of a custom parser.
- MoonBit remains focused on typed domain logic and deterministic streaming analysis.
- Dynamic third-party plugins are deferred until the static first-party core and ABI stabilize.
