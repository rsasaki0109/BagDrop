# Demo Assets

Playwright recordings of the BagDrop web UI.

| File | Flow |
| --- | --- |
| [`demo-clean-bag.gif`](demo-clean-bag.gif) | Drop clean demo bag → Healthy overview → `/odom` intervals/XY → `/temperature` value plot |
| [`demo-findings.gif`](demo-findings.gif) | Drop findings demo bag → warnings in findings panel |

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
