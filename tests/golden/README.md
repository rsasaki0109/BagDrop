# Golden Results

Checked-in `ResultBundle` examples for docs and regression checks.

| File | Purpose |
| --- | --- |
| [`sample_rosbag.result.json`](sample_rosbag.result.json) | Clean bag with `/odom` and `/fix`; all stream checks pass |
| [`sample_rosbag_with_findings.result.json`](sample_rosbag_with_findings.result.json) | Bag that triggers count mismatch, CDR decode failure, and large gap findings |

Regenerate both with:

```bash
UPDATE_GOLDEN=1 pnpm --filter @bagdrop/web exec vitest run tests/export_golden_result.test.ts
```

Golden topic entries include `plotTabs` metadata, `exportSchemaVersion: 1`, and omit downsampled plot series arrays.
