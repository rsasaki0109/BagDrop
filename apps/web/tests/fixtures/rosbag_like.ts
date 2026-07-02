import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { BagCatalog, BagFileSummary } from "../../src/model/result";
import type { WorkerFileRef } from "../../src/model/worker_messages";
import { runStreamAnalysis } from "../../src/workers/analysis/run_stream_analysis";
import { buildMinimalNavMsgsOdometryPayload } from "../../src/workers/moonbit/cdr";
import { catalogTopicToRegistration, TypeScriptMoonBitCoreBackend } from "../../src/workers/moonbit/typescript_backend";
import { MOONBIT_CORE_STATUS_OK } from "../../src/workers/moonbit/types";
import { WasmMoonBitCoreBackend } from "../../src/workers/moonbit/wasm_backend";
import { scanSqliteCatalog } from "../../src/workers/sqlite/catalog";

export async function createRosbagLikeDb(): Promise<Uint8Array> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:");
  const odomPayload = sqliteBlobLiteral(buildMinimalNavMsgsOdometryPayload());

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
          (1, 1, 1000000000, ${odomPayload}),
          (2, 1, 2000000000, ${odomPayload}),
          (3, 2, 2500000000, X'00'),
          (4, 1, 3000000000, ${odomPayload});
    `);

    return sqlite3.capi.sqlite3_js_db_export(db);
  } finally {
    db.close();
  }
}

export async function createExampleResultBundle() {
  const dbBytes = await createRosbagLikeDb();
  const dbBuffer = dbBytes.buffer.slice(
    dbBytes.byteOffset,
    dbBytes.byteOffset + dbBytes.byteLength
  ) as ArrayBuffer;
  const file = new File([dbBuffer], "segment_0.db3");
  const fileSummary: BagFileSummary = {
    id: "segment-0",
    path: "demo_bag/segment_0.db3",
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
  const catalog: BagCatalog = {
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

function sqliteBlobLiteral(payload: Uint8Array): string {
  const hex = [...payload].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `X'${hex}'`;
}

async function createWasmMoonBitCoreSession() {
  const wasmPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../public/moon/core.wasm"
  );
  const wasmBytes = readFileSync(wasmPath);
  const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), {});
  const backend = new WasmMoonBitCoreBackend({
    memory: instance.exports.memory as WebAssembly.Memory,
    exports: instance.exports as never
  });
  const handle = backend.create({ timeBasis: "record_time" });

  return {
    backendKind: backend.kind,
    registerTopics(topics: BagCatalog["topics"]) {
      for (const topic of topics) {
        expectRegisterOk(backend.registerTopic(handle, catalogTopicToRegistration(topic)));
      }
    },
    consumeBatch(batch: Parameters<TypeScriptMoonBitCoreBackend["consumeBatch"]>[1]) {
      expectRegisterOk(backend.consumeBatch(handle, batch));
    },
    finish() {
      const result = backend.finish(handle);
      backend.destroy(handle);
      return result;
    }
  };
}

function expectRegisterOk(status: number): void {
  if (status !== MOONBIT_CORE_STATUS_OK) {
    throw new Error(`MoonBit core returned status ${status}.`);
  }
}
