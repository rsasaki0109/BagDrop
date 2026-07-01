import { describe, expect, it } from "vitest";
import {
  createSQLiteImportChunkReader,
  OPFS_IMPORT_CHUNK_BYTES,
  OPFS_STAGING_DIR,
  stagingPathForId
} from "./opfs_fallback";

describe("stagingPathForId", () => {
  it("creates a stable OPFS path under the staging directory", () => {
    expect(stagingPathForId("segment-0")).toBe(`${OPFS_STAGING_DIR}/segment-0.db3`);
    expect(stagingPathForId("weird/id")).toBe(`${OPFS_STAGING_DIR}/weird_id.db3`);
  });
});

describe("createSQLiteImportChunkReader", () => {
  it("reads a file in fixed-size chunks and terminates with undefined", async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const file = new File([bytes], "segment_0.db3");
    const readChunk = createSQLiteImportChunkReader(file, 4);
    const chunks: Uint8Array[] = [];

    for (;;) {
      const chunk = await readChunk();
      if (!chunk) {
        break;
      }
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      new Uint8Array([0, 1, 2, 3]),
      new Uint8Array([4, 5, 6, 7]),
      new Uint8Array([8, 9])
    ]);
  });

  it("defaults to the configured import chunk size", () => {
    expect(OPFS_IMPORT_CHUNK_BYTES).toBe(4 * 1024 * 1024);
  });
});
