# MCAP support roadmap

BagDrop today analyzes **rosbag2 SQLite** (`.db3`) segments in the browser. **MCAP** (`.mcap`) files are recognized during inventory but are not read yet.

## Current behavior

| Layer | MCAP today |
| --- | --- |
| **Inventory** | `.mcap` paths are classified in `file_inventory.ts` and listed under `inventory.mcapFiles`. |
| **Warnings** | `mcap_not_supported_yet` when any MCAP file is present; `mixed_storage_formats` when both `.db3` and `.mcap` exist. |
| **Analysis** | Stream scan and MoonBit core consume SQLite topic batches only. MCAP bytes are never opened. |
| **UI** | Bag health reflects inventory warnings; no MCAP-specific plots or findings. |

This matches the MVP scope in [ADR 0001](../adr/0001-browser-worker-sqlite-moonbit.md): SQLite Wasm for storage access, MoonBit for deterministic stream verification.

## Why MCAP matters

- ROS 2 bags can be recorded as **MCAP** instead of (or alongside) SQLite.
- MCAP is a self-contained container format with indexed message streams; it avoids SQLite schema/version coupling.
- Users dropping an MCAP-only directory currently see inventory but **no topic analysis**.

## Design constraints (unchanged)

- All parsing stays **local-first** in a Worker; no bag bytes leave the device.
- Prefer **streaming** reads with bounded memory (same batching model as SQLite stream scan).
- MoonBit should remain the owner of **deterministic** verification (counts, gaps, CDR validation, value series).

## Options considered

### A. MCAP in TypeScript + existing MoonBit batch API (recommended first step)

1. Add an MCAP reader in the Worker (WASM or pure TS), emit `TopicMessageBatch` objects identical to the SQLite path.
2. Reuse `runStreamAnalysis`, MoonBit `consumeBatch`, and all TS registries (plots, diagnostics).
3. Keep inventory warnings until MCAP analysis is wired end-to-end.

**Pros:** Smallest change to MoonBit and UI; one analysis pipeline.  
**Cons:** MCAP decode complexity lives in TS unless later moved to MoonBit.

### B. Dual storage adapters behind a trait-like interface

- `StorageAdapter`: `listTopics()`, `scanBatches(onBatch)`.
- SQLite and MCAP each implement the adapter; Worker picks adapter(s) from inventory.

**Pros:** Clean separation when multiple formats coexist.  
**Cons:** More scaffolding before first MCAP byte is analyzed.

### C. MoonBit-native MCAP reader

- Parse MCAP inside MoonBit Wasm and expose the same finish JSON as today.

**Pros:** Single language for verification logic.  
**Cons:** Large upfront port; MCAP ecosystem tooling is TS-heavy today.

## Phased plan

### Phase 0 — Investigation (this document)

- Document current inventory and warning codes.
- Identify MCAP reader candidates (e.g. `@mcap/core` in Worker, or a thin WASM wrapper).
- Define golden MCAP fixture requirements (small bag, 2–3 topics, CDR payloads).

### Phase 1 — Read-only MCAP inventory + topic catalog

- Parse MCAP summary/statistics without full message decode.
- Populate `BagCatalog.topics` from MCAP channel metadata.
- Clear `mcap_not_supported_yet` for MCAP-only bags that successfully catalog.

### Phase 2 — Stream batches into MoonBit

- Implement MCAP message iteration with the same batch size limits as SQLite scan.
- Feed batches to MoonBit; enable stream findings and CDR column for MCAP-backed topics.
- Add golden tests with a tiny `.mcap` fixture.

### Phase 3 — Mixed bags and UX

- Handle directories with both `.db3` and `.mcap` as separate segments or merged catalog (product decision).
- Update bag health copy and README supported formats.
- Optional: MCAP-specific inventory chart slice (already reserved in `inventory_chart.ts`).

## Open questions

1. **Single vs multi source:** Should mixed SQLite + MCAP directories produce one combined result or block with a explicit user choice?
2. **Compression:** Which MCAP compression profiles must MVP support (none, lz4, zstd)?
3. **Time basis:** MCAP log time vs publish time — align with existing `timeBasis` config?
4. **Fixture licensing:** Ship a minimal synthetic MCAP in-repo (like demo `.db3` segments).

## Success criteria for Phase 2

- Drop an MCAP-only bag → topic table, findings, and value plots match SQLite parity for supported types.
- No regression on SQLite path; CI includes MCAP golden + schema validation.
- Inventory warning `mcap_not_supported_yet` removed when analysis completes successfully.

## Related code

- `apps/web/src/platform/file_inventory.ts` — classification and warnings
- `apps/web/src/workers/sqlite/stream_scan.ts` — reference batching pattern
- `apps/web/src/workers/moonbit/batch_codec.ts` — batch JSON consumed by MoonBit
- `moon/core/batch.mbt` — Wasm batch entry point
