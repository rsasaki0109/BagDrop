# BagDrop MoonBit Core

The Worker feeds `TopicMessageBatch` JSON payloads into this core through the Wasm ABI in `../cmd/core/`.

## Wasm exports

```text
core_create
core_register_topic
core_consume_batch
core_finish
core_result_ptr
core_result_len
core_free_result
core_destroy
```

## Result JSON

`core_finish` writes a JSON document to linear memory at offset `65536`. The host reads it through `core_result_ptr` / `core_result_len`.

Fields:

- `v` — schema version
- `topics` — per-topic aggregates (`messageCount`, `maxGapNs`, `meanRateHz`)
- `findings` — diagnostic findings (empty in the current skeleton)
- `batchesConsumed` — number of accepted batches

Build with `pnpm build:moon-core` from the repository root.

Registration JSON includes `catalogId` and `catalogCount` so the core can emit stream verification findings (count mismatches and large timestamp gaps).

Topic timestamps and gaps are tracked as `Int64` nanoseconds so values beyond 32-bit range and the 5 s gap threshold are handled correctly.
