import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { BagCatalog, BagFileSummary, ResultBundle } from "../../src/model/result";
import type { WorkerFileRef } from "../../src/model/worker_messages";
import { runStreamAnalysis } from "../../src/workers/analysis/run_stream_analysis";
import {
  buildMinimalNavMsgsOdometryPayload,
  buildMinimalSensorMsgsNavSatFixPayload
} from "../../src/workers/moonbit/cdr";
import { scanSqliteCatalog } from "../../src/workers/sqlite/catalog";
import { createWasmMoonBitCoreSession } from "./wasm_session";

export async function createExampleResultBundle(): Promise<ResultBundle> {
  const dbBytes = await createRosbagLikeDb();
  return buildResultBundleFromDb(dbBytes, "demo_bag/segment_0.db3", (catalog) => catalog);
}

export async function createFindingsResultBundle(): Promise<ResultBundle> {
  const dbBytes = await createRosbagWithFindingsDb();
  return buildResultBundleFromDb(dbBytes, "demo_bag/findings_segment_0.db3", (catalog) => ({
    ...catalog,
    topics: catalog.topics.map((topic) =>
      topic.name === "/fix"
        ? {
            ...topic,
            count: 5
          }
        : topic
    )
  }));
}

async function buildResultBundleFromDb(
  dbBytes: Uint8Array,
  path: string,
  transformCatalog: (catalog: BagCatalog) => BagCatalog
): Promise<ResultBundle> {
  const dbBuffer = dbBytes.buffer.slice(
    dbBytes.byteOffset,
    dbBytes.byteOffset + dbBytes.byteLength
  ) as ArrayBuffer;
  const file = new File([dbBuffer], "segment_0.db3");
  const fileSummary: BagFileSummary = {
    id: "segment-0",
    path,
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

  const sqliteCatalog = await scanSqliteCatalog([fileSummary], [fileRef]);
  const baseCatalog: BagCatalog = {
    inventory: {
      files: [fileSummary],
      totalSizeBytes: file.size,
      metadataFiles: [],
      sqliteFiles: [fileSummary],
      mcapFiles: [],
      messageDefinitionFiles: [],
      walFiles: [],
      journalFiles: [],
      warnings: []
    },
    schemaCapabilities: sqliteCatalog.schemaCapabilities,
    topics: sqliteCatalog.topics,
    messageCount: sqliteCatalog.messageCount,
    timeRange: sqliteCatalog.timeRange,
    storageStatus: "ready",
    findings: sqliteCatalog.findings
  };
  const catalog = transformCatalog(baseCatalog);
  const analysis = await runStreamAnalysis(catalog, [fileRef], createWasmMoonBitCoreSession);

  return {
    appVersion: "0.0.0",
    createdAt: "2026-07-02T10:00:00.000Z",
    catalog: {
      ...catalog,
      topics: analysis.topics,
      findings: [...catalog.findings, ...analysis.findings]
    },
    metrics: [
      {
        id: "total-size",
        label: "Total size",
        value: file.size,
        unit: "bytes"
      },
      {
        id: "message-count",
        label: "Messages",
        value: catalog.messageCount
      },
      {
        id: "storage-status",
        label: "Storage status",
        value: "ready"
      },
      ...analysis.metrics
    ],
    findings: [...catalog.findings, ...analysis.findings]
  };
}

async function createRosbagLikeDb(): Promise<Uint8Array> {
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());
  const fixPayload = sqliteBlobLiteral(buildMinimalSensorMsgsNavSatFixPayload());

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (2, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 1, 1000000000, ${odomPayload}),
        (2, 1, 2000000000, ${odomPayload}),
        (3, 2, 2500000000, ${fixPayload}),
        (4, 1, 3000000000, ${odomPayload});
  `);
}

async function createRosbagWithFindingsDb(): Promise<Uint8Array> {
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());
  const fixPayload = sqliteBlobLiteral(buildMinimalSensorMsgsNavSatFixPayload());

  return createRosbagDb(`
    INSERT INTO topics(id, name, type, serialization_format, offered_qos_profiles, type_description_hash)
      VALUES
        (1, '/fix', 'sensor_msgs/msg/NavSatFix', 'cdr', '', 'hash-fix'),
        (2, '/odom', 'nav_msgs/msg/Odometry', 'cdr', '', 'hash-odom'),
        (3, '/scan', 'sensor_msgs/msg/LaserScan', 'cdr', '', 'hash-scan');
    INSERT INTO messages(id, topic_id, timestamp, data)
      VALUES
        (1, 2, 1000000000, ${odomPayload}),
        (2, 2, 2000000000, ${odomPayload}),
        (3, 1, 2500000000, ${fixPayload}),
        (4, 1, 3500000000, X'00'),
        (5, 3, 1000000000, X'00'),
        (6, 3, 7000000000, X'00');
  `);
}

async function createRosbagDb(topicAndMessageSql: string): Promise<Uint8Array> {
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
      ${topicAndMessageSql}
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
