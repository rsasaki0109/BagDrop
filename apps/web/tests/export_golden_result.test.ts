import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createExampleResultBundle } from "./fixtures/rosbag_like";

const goldenPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../tests/golden/sample_rosbag.result.json"
);

describe("golden result", () => {
  it("matches the checked-in sample ResultBundle", async () => {
    const bundle = await createExampleResultBundle();
    bundle.createdAt = "2026-07-02T10:00:00.000Z";

    if (process.env.UPDATE_GOLDEN === "1") {
      mkdirSync(dirname(goldenPath), { recursive: true });
      writeFileSync(goldenPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
    }

    const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
    expect(bundle).toEqual(golden);
  });
});
