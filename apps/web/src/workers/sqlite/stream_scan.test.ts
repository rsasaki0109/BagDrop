import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { describe, expect, it } from "vitest";
import type { TopicCatalogEntry } from "../../model/result";
import { withReadonlySegmentDatabase } from "./db_session";
import { scanSegmentTopicStreams } from "./stream_scan";

describe("scanSegmentTopicStreams", () => {
  it("streams timestamps in batches and computes max gap and rate", async () => {
    const dbBytes = await createRosbagLikeDb();
    const dbBuffer = dbBytes.buffer.slice(
      dbBytes.byteOffset,
      dbBytes.byteOffset + dbBytes.byteLength
    ) as ArrayBuffer;
    const file = new File([dbBuffer], "segment_0.db3");
    const catalogTopics: TopicCatalogEntry[] = [
      {
        id: 0,
        name: "/odom",
        type: "nav_msgs/msg/Odometry",
        serializationFormat: "cdr",
        count: 3,
        timeRange: { startNs: 1_000_000_000, endNs: 3_000_000_000 },
        meanRateHz: null,
        maxGapNs: null,
        status: "unknown"
      },
      {
        id: 1,
        name: "/fix",
        type: "sensor_msgs/msg/NavSatFix",
        serializationFormat: "cdr",
        count: 1,
        timeRange: { startNs: 2_500_000_000, endNs: 2_500_000_000 },
        meanRateHz: null,
        maxGapNs: null,
        status: "unknown"
      }
    ];

    const result = await withReadonlySegmentDatabase(
      file,
      {
        id: "segment-0",
        path: "bag/segment_0.db3",
        name: "segment_0.db3",
        sizeBytes: file.size,
        kind: "sqlite",
        segmentOrdinal: 0
      },
      (db) => scanSegmentTopicStreams(db, catalogTopics)
    );

    expect(result.stats).toEqual([
      expect.objectContaining({
        topicName: "/odom",
        streamedCount: 3,
        maxGapNs: 1_000_000_000,
        meanRateHz: 1.5,
        batchesRead: 1
      }),
      expect.objectContaining({
        topicName: "/fix",
        streamedCount: 1,
        maxGapNs: null,
        batchesRead: 1
      })
    ]);
  });
});

async function createRosbagLikeDb(): Promise<Uint8Array> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");

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
        VALUES
          (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr'),
          (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr');
      INSERT INTO messages(id, topic_id, timestamp, data)
        VALUES
          (1, 1, 1000000000, X'00'),
          (2, 1, 2000000000, X'00'),
          (3, 2, 2500000000, X'00'),
          (4, 1, 3000000000, X'00');
    `);

    return sqlite3.capi.sqlite3_js_db_export(db);
  } finally {
    db.close();
  }
}
