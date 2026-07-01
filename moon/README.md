# MoonBit Workspace

BagDrop's streaming analysis core is implemented in MoonBit and compiled to Wasm for the browser Worker.

## Packages

- `core/` — topic state, batch ingestion, result JSON serialization
- `cmd/core/` — Wasm ABI exports consumed by `apps/web/src/workers/moonbit_bridge.ts`

## Build

Requires the [MoonBit CLI](https://www.moonbitlang.com/download):

```bash
pnpm build:moon-core
```

This runs `moon build --target wasm --release cmd/core` and copies the artifact to `apps/web/public/moon/core.wasm`.

At runtime the Worker prefers `core.wasm`, then falls back to `core.stub.wasm`, then to the TypeScript backend.

## Verify

```bash
cd moon
moon check
moon build --target wasm --release cmd/core
```
