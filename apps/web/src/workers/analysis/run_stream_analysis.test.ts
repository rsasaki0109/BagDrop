import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { describe, expect, it } from "vitest";
import type { BagCatalog } from "../../model/result";
import type { WorkerFileRef } from "../../model/worker_messages";
import { buildMinimalNavMsgsOdometryPayload } from "../moonbit/cdr";
import { runStreamAnalysis } from "./run_stream_analysis";
import { TypeScriptMoonBitCoreBackend, catalogTopicToRegistration } from "../moonbit/typescript_backend";
import { MOONBIT_CORE_STATUS_OK } from "../moonbit/types";

describe("runStreamAnalysis", () => {
  it("marks topics ok and adds stream metrics when counts match", async () => {
    const dbBytes = await createRosbagLikeDb();
    const dbBuffer = dbBytes.buffer.slice(
      dbBytes.byteOffset,
      dbBytes.byteOffset + dbBytes.byteLength
    ) as ArrayBuffer;
    const file = new File([dbBuffer], "segment_0.db3");
    const fileRef: WorkerFileRef = {
      id: "segment-0",
      path: "bag/segment_0.db3",
      file
    };
    const catalog: BagCatalog = {
      inventory: {
        files: [],
        totalSizeBytes: file.size,
        metadataFiles: [],
        sqliteFiles: [
          {
            id: "segment-0",
            path: "bag/segment_0.db3",
            name: "segment_0.db3",
            sizeBytes: file.size,
            kind: "sqlite",
            segmentOrdinal: 0
          }
        ],
        mcapFiles: [],
        messageDefinitionFiles: [],
        walFiles: [],
        journalFiles: [],
        warnings: []
      },
      schemaCapabilities: ["legacy"],
      topics: [
        {
          id: 0,
          name: "/odom",
          type: "nav_msgs/msg/Odometry",
          serializationFormat: "cdr",
          count: 3,
          timeRange: { startNs: 1_000_000_000, endNs: 3_000_000_000 },
          meanRateHz: 1.5,
          maxGapNs: null,
          status: "unknown"
        }
      ],
      messageCount: 3,
      timeRange: { startNs: 1_000_000_000, endNs: 3_000_000_000 },
      storageStatus: "ready",
      findings: []
    };

    const analysis = await runStreamAnalysis(catalog, [fileRef], async () => {
      const backend = new TypeScriptMoonBitCoreBackend();
      const handle = backend.create({ timeBasis: "record_time" });

      return {
        backendKind: backend.kind,
        registerTopics(topics) {
          for (const topic of topics) {
            expect(backend.registerTopic(handle, catalogTopicToRegistration(topic))).toBe(
              MOONBIT_CORE_STATUS_OK
            );
          }
        },
        consumeBatch(batch) {
          expect(backend.consumeBatch(handle, batch)).toBe(MOONBIT_CORE_STATUS_OK);
        },
        finish() {
          const result = backend.finish(handle);
          backend.destroy(handle);
          return result;
        }
      };
    });

    expect(analysis.topics[0]).toEqual(
      expect.objectContaining({
        name: "/odom",
        status: "ok",
        maxGapNs: 1_000_000_000,
        meanRateHz: 1.5,
        decodedPayloads: 3,
        decodeErrors: 0,
        intervalSeries: [
          { timestampNs: 2_000_000_000, deltaNs: 1_000_000_000 },
          { timestampNs: 3_000_000_000, deltaNs: 1_000_000_000 }
        ],
        trajectorySeries: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 }
        ]
      })
    );
    expect(analysis.findings).toEqual([]);
    expect(analysis.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "stream-segments-scanned", value: 1 }),
        expect.objectContaining({ id: "stream-verified-topics", value: 1 }),
        expect.objectContaining({ id: "moonbit-backend", value: "typescript" }),
        expect.objectContaining({ id: "moonbit-batches-consumed", value: 1 })
      ])
    );
  });
});

async function createRosbagLikeDb(): Promise<Uint8Array> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());

  try {
    db.exec(`
      CREATE TABLE topics(
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        serialization_format TEXT NOT NULL
      );
      CREATE TABLE messages(
        id INTEGER PRIMARY KEY,
        topic_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        data BLOB NOT NULL
      );

      INSERT INTO topics(id, name, type, serialization_format)
        VALUES (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr');
      INSERT INTO messages(id, topic_id, timestamp, data)
        VALUES
          (1, 1, 1000000000, ${odomPayload}),
          (2, 1, 2000000000, ${odomPayload}),
          (3, 1, 3000000000, ${odomPayload});
    `);

    return sqlite3.capi.sqlite3_js_db_export(db);
  } finally {
    db.close();
  }
}

function sqliteBlobLiteral(payload: Uint8Array): string {
  const hex = [...payload].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `X'${hex}'`;
}
