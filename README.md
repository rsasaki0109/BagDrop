# BagDrop

BagDrop is a local-first ROS 2 bag diagnostic tool. It accepts a bag directory or `.db3` file in the browser, produces a fast overview, and runs targeted deterministic analysis without uploading bag data.

The bag Worker scans SQLite catalogs, streams topic timestamps in batches, and feeds them to the MoonBit analysis core. Official SQLite Wasm handles database access; MoonBit Wasm owns stream verification findings and topic statistics.

## Development

```bash
pnpm install
pnpm dev
```

Build the MoonBit core Wasm module (requires the [MoonBit CLI](https://www.moonbitlang.com/download)):

```bash
pnpm build:moon-core
```

The app is served from `apps/web` and is configured for GitHub Project Pages with `base: "/bagdrop/"`.

## Architecture Direction

- TypeScript owns browser APIs, drag and drop, Worker lifecycle, rendering, PWA, and local exports.
- Official SQLite Wasm owns SQLite parsing, B-tree access, schema probing, and database integrity behavior.
- MoonBit Wasm owns streaming statistics, stream verification findings, and (later) CDR decoding, diagnostics, health scoring, and plugin contracts.
- Bag data stays on the user's device. The app must not send raw bag bytes, decoded messages, derived statistics, or generated reports to the network.

See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/privacy.md](docs/privacy.md).
