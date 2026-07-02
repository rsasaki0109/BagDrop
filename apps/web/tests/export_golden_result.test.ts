import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResultBundle } from "../../src/model/result";
import { createExampleResultBundle, createFindingsResultBundle } from "./fixtures/result_bundle";

const goldenDir = join(import.meta.dirname, "../../../tests/golden");

const goldenFiles = [
  {
    name: "sample_rosbag.result.json",
    create: createExampleResultBundle
  },
  {
    name: "sample_rosbag_with_findings.result.json",
    create: createFindingsResultBundle
  }
] as const;

describe("golden results", () => {
  for (const golden of goldenFiles) {
    it(`matches ${golden.name}`, async () => {
      const bundle = stripPlotSeries(await golden.create());
      bundle.createdAt = "2026-07-02T10:00:00.000Z";
      const goldenPath = join(goldenDir, golden.name);

      if (process.env.UPDATE_GOLDEN === "1") {
        writeFileSync(goldenPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
      }

      const expected = stripPlotSeries(JSON.parse(readFileSync(goldenPath, "utf8")) as ResultBundle);
      expect(bundle).toEqual(expected);
    });
  }
});

function stripPlotSeries(bundle: ResultBundle): ResultBundle {
  return {
    ...bundle,
    catalog: {
      ...bundle.catalog,
      topics: bundle.catalog.topics.map(
        ({
          intervalSeries: _intervalSeries,
          trajectorySeries: _trajectorySeries,
          geopointSeries: _geopointSeries,
          ...topic
        }) => topic
      )
    }
  };
}
