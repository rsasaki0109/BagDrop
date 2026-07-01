import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { describe, expect, it } from "vitest";
import type { BagFileSummary } from "../../model/result";
import type { WorkerFileRef } from "../../model/worker_messages";
import { scanSqliteCatalog, MAX_DESERIALIZE_DB_BYTES } from "./catalog";

describe("scanSqliteCatalog", () => {
  it("reads rosbag2 topic catalog and aggregate message stats", async () => {
    const dbBytes = await createRosbagLikeDb();
    const dbBuffer = dbBytes.buffer.slice(
      dbBytes.byteOffset,
      dbBytes.byteOffset + dbBytes.byteLength
    ) as ArrayBuffer;
    const file = new File([dbBuffer], "segment_0.db3");
    const fileSummary: BagFileSummary = {
      id: "segment-0",
      path: "bag/segment_0.db3",
      name: "segment_0.db3",
      sizeBytes: file.size,
      kind: "sqlite",
      segmentOrdinal: 0
    };
    const fileRef: WorkerFileRef = {
      id: fileSummary.id,
      path: fileSummary.path,
      file
    };

    const catalog = await scanSqliteCatalog([fileSummary], [fileRef]);

    expect(catalog.scannedFiles).toBe(1);
    expect(catalog.skippedFiles).toBe(0);
    expect(catalog.messageCount).toBe(4);
    expect(catalog.schemaCapabilities).toEqual([
      "has_embedded_definitions",
      "has_embedded_metadata",
      "has_qos",
      "has_type_hash",
      "legacy"
    ]);
    expect(catalog.timeRange).toEqual({
      startNs: 1_000_000_000,
      endNs: 3_000_000_000
    });
    expect(catalog.topics).toEqual([
      expect.objectContaining({
        name: "/fix",
        type: "sensor_msgs/msg/NavSatFix",
        count: 1,
        meanRateHz: null
      }),
      expect.objectContaining({
        name: "/odom",
        type: "nav_msgs/msg/Odometry",
        count: 3,
        meanRateHz: 1.5
      })
    ]);
  });

  it("defers large sqlite files when DirectFileVFS is unavailable", async () => {
    const dbBytes = await createRosbagLikeDb();
    const dbBuffer = dbBytes.buffer.slice(
      dbBytes.byteOffset,
      dbBytes.byteOffset + dbBytes.byteLength
    ) as ArrayBuffer;
    const oversizedBytes = MAX_DESERIALIZE_DB_BYTES + 1;
    const file = new File([dbBuffer], "segment_0.db3");
    Object.defineProperty(file, "size", {
      configurable: true,
      value: oversizedBytes
    });

    const fileSummary: BagFileSummary = {
      id: "segment-0",
      path: "bag/segment_0.db3",
      name: "segment_0.db3",
      sizeBytes: oversizedBytes,
      kind: "sqlite",
      segmentOrdinal: 0
    };
    const fileRef: WorkerFileRef = {
      id: fileSummary.id,
      path: fileSummary.path,
      file
    };

    const catalog = await scanSqliteCatalog([fileSummary], [fileRef]);

    expect(catalog.scannedFiles).toBe(0);
    expect(catalog.skippedFiles).toBe(1);
    expect(catalog.topics).toEqual([]);
    expect(catalog.findings).toEqual([
      expect.objectContaining({
        severity: "warning",
        title: "SQLite catalog deferred",
        evidence: expect.objectContaining({
          path: "bag/segment_0.db3",
          sizeBytes: oversizedBytes,
          maxDeserializeBytes: MAX_DESERIALIZE_DB_BYTES,
          reason: "SQLite OPFS backend is unavailable in this browser Worker."
        })
      })
    ]);
  });
});

async function createRosbagLikeDb(): Promise<Uint8Array> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");

  try {
    db.exec(`
      CREATE TABLE schema(schema_version INTEGER, ros_distro TEXT);
      CREATE TABLE metadata(key TEXT, value TEXT);
      CREATE TABLE message_definitions(topic_type TEXT, encoding TEXT, encoded_message_definition TEXT);
      CREATE TABLE topics(
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        serialization_format TEXT NOT NULL,
        offered_qos_profiles TEXT,
        type_description_hash TEXT
      );
      CREATE TABLE messages(
        id INTEGER PRIMARY KEY,
        topic_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        data BLOB NOT NULL
      );

      INSERT INTO metadata(key, value) VALUES ('ros_distro', 'jazzy');
      INSERT INTO message_definitions(topic_type, encoding, encoded_message_definition)
        VALUES ('nav_msgs/msg/Odometry', 'ros2msg', 'string child_frame_id');
      INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
        VALUES
          (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
          (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix');
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
