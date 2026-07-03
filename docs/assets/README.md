# Demo Assets

Playwright recordings of the BagDrop web UI.

| File | Flow |
| --- | --- |
| [`demo-clean-bag.gif`](demo-clean-bag.gif) | Drop clean demo bag → Healthy overview → `/odom` XY → `/imu` and twist value plots on `/cmd_vel` and `/velocity` |
| [`demo-findings.gif`](demo-findings.gif) | Drop findings demo bag → click finding topic badge → open topic plot |

## Regenerate

From the repo root:

```bash
pnpm --filter @bagdrop/web exec playwright install chromium --with-deps   # once
pnpm --filter @bagdrop/web record:demo
```

Requirements:

- Playwright Chromium (installed by the command above)
- ffmpeg on `PATH`

The script starts a local Vite dev server, drives the UI with Playwright, captures PNG frames, and writes GIFs with ffmpeg palette optimization.
