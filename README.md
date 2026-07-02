# BagDrop

BagDrop is a local-first ROS 2 bag diagnostic tool. It accepts a bag directory or `.db3` file in the browser, produces a fast overview, and runs targeted deterministic analysis without uploading bag data.

The bag Worker scans SQLite catalogs, streams topic timestamps in batches, and feeds them to the MoonBit analysis core. Official SQLite Wasm handles database access; MoonBit Wasm owns stream verification findings, topic statistics, and starter CDR validation.

**Live demo:** https://rsasaki0109.github.io/BagDrop/

## Example Result

Dropping a single rosbag2 SQLite segment (`demo_bag/segment_0.db3`) with two topics produces a local `ResultBundle` like this:

### Overview

| Metric | Value |
| --- | --- |
| Files | 1 |
| SQLite segments | 1 |
| Messages | 4 |
| Topics | 2 |
| Storage status | `ready` |
| Findings | 0 |

### Topics

| Topic | Type | Count | Mean rate | Max gap | CDR | Status |
| --- | --- | ---: | --- | --- | --- | --- |
| `/fix` | `sensor_msgs/msg/NavSatFix` | 1 | N/A | N/A | No payloads | `ok` |
| `/odom` | `nav_msgs/msg/Odometry` | 3 | 1.5 Hz | 1 s | 3 ok | `ok` |

Stream analysis verifies catalog counts, computes refined rates and gaps, and validates known CDR payloads. In this sample, all three `/odom` messages decode successfully as `nav_msgs/msg/Odometry`.

### Findings

No findings for this clean sample bag.

### Export

The full JSON export is checked in as [`tests/golden/sample_rosbag.result.json`](tests/golden/sample_rosbag.result.json). Regenerate it with:

```bash
UPDATE_GOLDEN=1 pnpm --filter @bagdrop/web exec vitest run tests/export_golden_result.test.ts
```

## Development

```bash
pnpm install
pnpm dev
```

Build the MoonBit core Wasm module (requires the [MoonBit CLI](https://www.moonbitlang.com/download)):

```bash
pnpm build:moon-core
```

The app is served from `apps/web` and is configured for GitHub Project Pages with `base: "/BagDrop/"` (must match the repository name).

## Architecture Direction

- TypeScript owns browser APIs, drag and drop, Worker lifecycle, rendering, PWA, and local exports.
- Official SQLite Wasm owns SQLite parsing, B-tree access, schema probing, and database integrity behavior.
- MoonBit Wasm owns streaming statistics, stream verification findings, starter CDR validation, and (later) diagnostics, health scoring, and plugin contracts.
- Bag data stays on the user's device. The app must not send raw bag bytes, decoded messages, derived statistics, or generated reports to the network.

See [docs/architecture/overview.md](docs/architecture/overview.md) and [docs/privacy.md](docs/privacy.md).
