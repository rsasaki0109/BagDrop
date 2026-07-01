import { describe, expect, it } from "vitest";
import { buildInventory, classifyPath } from "./file_inventory";
import type { WorkerFileRef } from "../model/worker_messages";

describe("classifyPath", () => {
  it("classifies supported bag-related files", () => {
    expect(classifyPath("bag/metadata.yaml")).toBe("metadata");
    expect(classifyPath("bag/segment_0.db3")).toBe("sqlite");
    expect(classifyPath("bag/segment_0.db3-wal")).toBe("wal");
    expect(classifyPath("bag/segment_0.db3-journal")).toBe("journal");
    expect(classifyPath("schema/NavSatFix.msg")).toBe("message_definition");
    expect(classifyPath("schema/example.idl")).toBe("message_definition");
    expect(classifyPath("bag/output.mcap")).toBe("mcap");
  });
});

describe("buildInventory", () => {
  it("assigns stable sqlite segment ordinals by natural path order", () => {
    const inventory = buildInventory([
      fileRef("bag/segment_10.db3", 10),
      fileRef("bag/segment_2.db3", 20),
      fileRef("bag/segment_1.db3", 30),
      fileRef("bag/metadata.yaml", 1)
    ]);

    expect(inventory.sqliteFiles.map((file) => [file.path, file.segmentOrdinal])).toEqual([
      ["bag/segment_1.db3", 0],
      ["bag/segment_2.db3", 1],
      ["bag/segment_10.db3", 2]
    ]);
  });

  it("reports blocking WAL and journal files", () => {
    const inventory = buildInventory([
      fileRef("bag/segment_0.db3", 100),
      fileRef("bag/segment_0.db3-wal", 10),
      fileRef("bag/segment_0.db3-journal", 10)
    ]);

    expect(inventory.warnings.map((warning) => warning.code)).toContain("wal_present");
    expect(inventory.warnings.map((warning) => warning.code)).toContain("journal_present");
  });

  it("keeps metadata-only failures explicit", () => {
    const inventory = buildInventory([fileRef("bag/metadata.yaml", 1)]);
    expect(inventory.warnings).toContainEqual(
      expect.objectContaining({
        severity: "error",
        code: "no_storage_file"
      })
    );
  });
});

function fileRef(path: string, size: number): WorkerFileRef {
  return {
    id: path,
    path,
    file: new File([new Uint8Array(size)], path.split("/").at(-1) ?? path)
  };
}
