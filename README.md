# BagDrop

BagDrop is a local-first ROS 2 bag diagnostic tool. It accepts a bag directory or `.db3` file in the browser, produces a fast overview, and runs targeted deterministic analysis without uploading bag data.

The bag Worker scans SQLite catalogs, streams topic timestamps in batches, and feeds them to the MoonBit analysis core. Official SQLite Wasm handles database access; MoonBit Wasm owns stream verification findings, topic statistics, and starter CDR validation.

**Live demo:** https://rsasaki0109.github.io/BagDrop/

## Example Result

BagDrop turns a dropped rosbag2 SQLite segment into a local `ResultBundle` without uploading bytes.

```mermaid
flowchart LR
  A[Drop .db3] --> B[Inventory]
  B --> C[SQLite catalog]
  C --> D[Stream scan]
  D --> E[MoonBit core]
  E --> F[Overview + Findings + JSON export]

  style F fill:#1f2b26,stroke:#6fae92,color:#e7f2ec
```

### Clean bag

[`sample_rosbag.result.json`](tests/golden/sample_rosbag.result.json) — `demo_bag/segment_0.db3`

| | |
| --- | --- |
| **Overview** | 7 messages · 3 topics · `ready` · **0 findings** |
| **Backend** | MoonBit `wasm` |

**Topics**

| Topic | Type | Count | Rate | Max gap | CDR | Status |
| --- | --- | ---: | --- | --- | --- | :---: |
| `/fix` | `sensor_msgs/msg/NavSatFix` | 1 | N/A | N/A | **1 ok** | ok |
| `/odom` | `nav_msgs/msg/Odometry` | 3 | 1.5 Hz | 1 s | **3 ok** | ok |
| `/temperature` | `std_msgs/msg/Float64` | 3 | 1.5 Hz | 0.7 s | **3 ok** | ok |

**Findings panel**

```text
(no findings)
```

Both GNSS and odometry payloads decode successfully. This is the “all green” path.

**Topic plots**

Select a topic row to open the plot panel below the Topics table. Available tabs depend on message type:

| Topic | Tabs |
| --- | --- |
| `/odom` | **Intervals** · XY trajectory |
| `/fix` | **Intervals** · Lat/Lon |
| `/temperature` | **Intervals** · Value |

```text
┌─ Topic Plot ─ /odom · 2 points ────────────────────────────────┐
│ [Intervals]  Value  XY trajectory  Lat/Lon                     │
│ Message interval Δt (seconds) vs bag time.                     │
│                                                                │
│     1.0s ┤              ●                                      │
│          │         ●                                           │
│     0.5s ┤    ●                                                │
│          └────────────────────────────────────────── bag time  │
└────────────────────────────────────────────────────────────────┘

┌─ Topic Plot ─ /temperature · 3 points ─────────────────────────┐
│ Intervals  [Value]  XY trajectory  Lat/Lon                     │
│ Decoded std_msgs/msg/Float64 values over bag time.             │
│                                                                │
│      44 ┤                              ●                       │
│      43 ┤                   ●                                  │
│      42 ┤          ●                                           │
│          └────────────────────────────────────────── bag time  │
└────────────────────────────────────────────────────────────────┘
```

### Bag with findings

[`sample_rosbag_with_findings.result.json`](tests/golden/sample_rosbag_with_findings.result.json) — `demo_bag/findings_segment_0.db3`

| | |
| --- | --- |
| **Overview** | 6 messages · 3 topics · `ready` · **3 findings** |
| **Summary** | `1 error · 2 warnings` |

**Topics**

| Topic | Type | CDR | Status | Why |
| --- | --- | --- | :---: | --- |
| `/fix` | `NavSatFix` | 1/2 ok | error | catalog says 5 msgs, stream found 2; 1 bad payload |
| `/odom` | `Odometry` | 2 ok | ok | baseline healthy topic |
| `/scan` | `LaserScan` | N/A | warning | 6 s gap between messages |

**Findings panel (as shown in the UI)**

```text
┌─ ERROR ─ Stream ─────────────────────────────────────────────┐
│ Stream count mismatch                                        │
│ Topic /fix streamed 2 messages, but catalog reported 5.      │
│ /fix · streamedCount=2 · catalogCount=5                      │
└──────────────────────────────────────────────────────────────┘

┌─ WARNING ─ Stream ───────────────────────────────────────────┐
│ CDR decode failures                                          │
│ Topic /fix had 1 payload that could not be decoded.          │
│ /fix · decodedPayloads=1 · decodeErrors=1                    │
└──────────────────────────────────────────────────────────────┘

┌─ WARNING ─ Stream ───────────────────────────────────────────┐
│ Large timestamp gap                                          │
│ Topic /scan has a maximum inter-message gap of 6 s.          │
│ /scan · maxGapNs=6000000000                                  │
└──────────────────────────────────────────────────────────────┘
```

Try it live: drop a bag at https://rsasaki0109.github.io/BagDrop/ — findings appear in the right-hand panel with severity pills, topic badges, and evidence rows.

### Regenerate golden exports

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
