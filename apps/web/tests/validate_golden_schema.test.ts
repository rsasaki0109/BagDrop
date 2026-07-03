import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import type { ResultBundle } from "../src/model/result";
import { assertExportBundleShape } from "./validate_export_shape";

const repoRoot = join(import.meta.dirname, "../../..");
const goldenDir = join(repoRoot, "tests/golden");
const schemaDir = join(repoRoot, "schemas");
const exportSchemaPath = join(schemaDir, "result.export.schema.json");
const baseSchemaPath = join(schemaDir, "result.schema.json");

const goldenFiles = ["sample_rosbag.result.json", "sample_rosbag_with_findings.result.json"] as const;

function createExportValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  ajv.addSchema(JSON.parse(readFileSync(baseSchemaPath, "utf8")));
  return ajv.compile(JSON.parse(readFileSync(exportSchemaPath, "utf8")));
}

describe("golden export schema", () => {
  const validate = createExportValidator();

  for (const fileName of goldenFiles) {
    it(`validates ${fileName} against result.export.schema.json`, () => {
      const bundle = JSON.parse(readFileSync(join(goldenDir, fileName), "utf8")) as ResultBundle;
      assertExportBundleShape(bundle);

      const valid = validate(bundle);
      if (!valid) {
        expect(validate.errors, JSON.stringify(validate.errors, null, 2)).toBeUndefined();
      }

      expect(valid).toBe(true);
    });
  }
});
