# Golden Results

Checked-in `ResultBundle` examples for docs and regression checks.

- [`sample_rosbag.result.json`](sample_rosbag.result.json) — single `.db3` segment with `/odom` and `/fix`, used in the README example output section.

Regenerate with:

```bash
UPDATE_GOLDEN=1 pnpm --filter @bagdrop/web exec vitest run tests/export_golden_result.test.ts
```
