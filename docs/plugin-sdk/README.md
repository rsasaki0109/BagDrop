# Plugin SDK Notes

MVP plugins are statically linked into the MoonBit core:

- `builtin.generic`
- `builtin.trajectory`
- `builtin.gnss-basic`

Analyzer plugins declare required topics and fields. They do not issue SQL directly. The host query scheduler merges analysis plans so CDR decoding is performed once per required field batch.

Future dynamic plugin packages may use:

```text
plugin.bdp
├─ manifest.json
├─ plugin.wasm
├─ README.md
└─ LICENSE
```

Dynamic plugins must not access DOM, File, SQLite, OPFS, `fetch`, WebSocket, or arbitrary browser APIs directly. The host passes approved columnar batches and may terminate the plugin Worker when resource limits are exceeded.
