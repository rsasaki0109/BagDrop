import type { Database, SqlValue } from "@sqlite.org/sqlite-wasm";
import type {
  BagFileSummary,
  Finding,
  SchemaCapability,
  TimeRange,
  TopicCatalogEntry
} from "../../model/result";
import type { WorkerFileRef } from "../../model/worker_messages";
import {
  SqliteSegmentDeferredError,
  withReadonlySegmentDatabase
} from "./db_session";

export { MAX_DESERIALIZE_DB_BYTES } from "./db_session";

interface SegmentCatalog {
  capabilities: Set<SchemaCapability>;
  topics: SegmentTopic[];
  findings: Finding[];
}

interface SegmentTopic {
  segmentOrdinal: number;
  topicId: number;
  name: string;
  type: string;
  serializationFormat: string | null;
  count: number;
  minTimestamp: number | null;
  maxTimestamp: number | null;
}

export interface SqliteCatalogResult {
  topics: TopicCatalogEntry[];
  schemaCapabilities: SchemaCapability[];
  messageCount: number;
  timeRange: TimeRange;
  findings: Finding[];
  scannedFiles: number;
  skippedFiles: number;
}

export async function scanSqliteCatalog(
  sqliteFiles: readonly BagFileSummary[],
  fileRefs: readonly WorkerFileRef[]
): Promise<SqliteCatalogResult> {
  const fileById = new Map(fileRefs.map((fileRef) => [fileRef.id, fileRef.file]));
  const findings: Finding[] = [];
  const capabilities = new Set<SchemaCapability>();
  const segmentTopics: SegmentTopic[] = [];
  let scannedFiles = 0;
  let skippedFiles = 0;

  for (const sqliteFile of sqliteFiles) {
    const file = fileById.get(sqliteFile.id);
    if (!file) {
      skippedFiles += 1;
      findings.push({
        id: `sqlite-file-missing-${sqliteFile.id}`,
        severity: "error",
        title: "SQLite file handle missing",
        detail: `The selected file ${sqliteFile.path} is no longer available.`,
        evidence: { path: sqliteFile.path }
      });
      continue;
    }

    try {
      const segment = await withReadonlySegmentDatabase(file, sqliteFile, (db) =>
        scanOpenDatabase(db, sqliteFile)
      );
      scannedFiles += 1;
      segment.findings.forEach((finding) => findings.push(finding));
      segment.capabilities.forEach((capability) => capabilities.add(capability));
      segment.topics.forEach((topic) => segmentTopics.push(topic));
    } catch (error) {
      if (error instanceof SqliteSegmentDeferredError) {
        skippedFiles += 1;
        findings.push(error.finding);
        continue;
      }

      skippedFiles += 1;
      findings.push({
        id: `sqlite-scan-failed-${sqliteFile.id}`,
        severity: "error",
        title: "SQLite catalog scan failed",
        detail: error instanceof Error ? error.message : String(error),
        evidence: {
          path: sqliteFile.path
        }
      });
    }
  }

  const topics = mergeSegmentTopics(segmentTopics);
  const messageCount = topics.reduce((total, topic) => total + (topic.count ?? 0), 0);

  return {
    topics,
    schemaCapabilities: [...capabilities].sort(),
    messageCount,
    timeRange: mergeTopicTimeRanges(topics),
    findings,
    scannedFiles,
    skippedFiles
  };
}

function scanOpenDatabase(db: Database, summary: BagFileSummary): SegmentCatalog {
  const tables = tableNames(db);
  const capabilities = detectCapabilities(db, tables);
  const findings: Finding[] = [];

  if (!tables.has("topics")) {
    findings.push({
      id: `missing-topics-table-${summary.id}`,
      severity: "error",
      title: "Missing topics table",
      detail: `${summary.path} does not contain the rosbag2 topics table.`,
      evidence: { path: summary.path }
    });
    return {
      capabilities,
      topics: [],
      findings
    };
  }

  if (!tables.has("messages")) {
    findings.push({
      id: `missing-messages-table-${summary.id}`,
      severity: "error",
      title: "Missing messages table",
      detail: `${summary.path} does not contain the rosbag2 messages table.`,
      evidence: { path: summary.path }
    });
    return {
      capabilities,
      topics: [],
      findings
    };
  }

  const topics = readSegmentTopics(db, summary.segmentOrdinal ?? 0, summary.path);
  return {
    capabilities,
    topics,
    findings
  };
}

function tableNames(db: Database): Set<string> {
  const rows = db.selectObjects(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `);

  return new Set(rows.map((row) => valueAsString(row.name)).filter((name) => name.length > 0));
}

function detectCapabilities(db: Database, tables: Set<string>): Set<SchemaCapability> {
  const capabilities = new Set<SchemaCapability>(["legacy"]);

  if (tables.has("metadata")) {
    capabilities.add("has_embedded_metadata");
  }

  if (tables.has("message_definitions")) {
    capabilities.add("has_embedded_definitions");
  }

  if (tables.has("topics")) {
    const topicColumns = tableColumns(db, "topics");
    if (topicColumns.has("offered_qos_profiles")) {
      capabilities.add("has_qos");
    }
    if (topicColumns.has("type_description_hash")) {
      capabilities.add("has_type_hash");
    }
  }

  return capabilities;
}

function tableColumns(db: Database, tableName: string): Set<string> {
  const rows = db.selectObjects(`PRAGMA table_info(${quoteIdentifier(tableName)})`);
  return new Set(rows.map((row) => valueAsString(row.name)).filter((name) => name.length > 0));
}

function readSegmentTopics(db: Database, segmentOrdinal: number, path: string): SegmentTopic[] {
  const topicRows = db.selectObjects(`
    SELECT
      id,
      name,
      type,
      serialization_format AS serializationFormat
    FROM topics
    ORDER BY id
  `);

  const countRows = db.selectObjects(`
    SELECT
      topic_id AS topicId,
      COUNT(id) AS count,
      MIN(timestamp) AS minTimestamp,
      MAX(timestamp) AS maxTimestamp
    FROM messages
    GROUP BY topic_id
  `);

  const statsByTopicId = new Map<number, Record<string, SqlValue>>();
  for (const row of countRows) {
    const topicId = valueAsNumber(row.topicId);
    if (topicId !== null) {
      statsByTopicId.set(topicId, row);
    }
  }

  return topicRows.map((row) => {
    const topicId = valueAsNumber(row.id);
    if (topicId === null) {
      throw new Error(`Invalid topic id in ${path}`);
    }

    const stats = statsByTopicId.get(topicId);

    return {
      segmentOrdinal,
      topicId,
      name: valueAsString(row.name),
      type: valueAsString(row.type),
      serializationFormat: valueAsNullableString(row.serializationFormat),
      count: valueAsNumber(stats?.count) ?? 0,
      minTimestamp: valueAsNumber(stats?.minTimestamp),
      maxTimestamp: valueAsNumber(stats?.maxTimestamp)
    };
  });
}

function mergeSegmentTopics(segmentTopics: readonly SegmentTopic[]): TopicCatalogEntry[] {
  const merged = new Map<string, SegmentTopic[]>();

  for (const topic of segmentTopics) {
    const key = [topic.name, topic.type, topic.serializationFormat ?? ""].join("\u0000");
    const bucket = merged.get(key);
    if (bucket) {
      bucket.push(topic);
    } else {
      merged.set(key, [topic]);
    }
  }

  return [...merged.values()]
    .sort((a, b) => a[0].name.localeCompare(b[0].name, undefined, { numeric: true, sensitivity: "base" }))
    .map((topics, index) => {
      const count = topics.reduce((total, topic) => total + topic.count, 0);
      const minTimestamp = minNullable(topics.map((topic) => topic.minTimestamp));
      const maxTimestamp = maxNullable(topics.map((topic) => topic.maxTimestamp));
      const durationSeconds =
        minTimestamp === null || maxTimestamp === null || maxTimestamp <= minTimestamp
          ? null
          : (maxTimestamp - minTimestamp) / 1_000_000_000;

      return {
        id: index,
        name: topics[0].name,
        type: topics[0].type,
        serializationFormat: topics[0].serializationFormat,
        count,
        timeRange: {
          startNs: minTimestamp,
          endNs: maxTimestamp
        },
        meanRateHz: durationSeconds && durationSeconds > 0 ? count / durationSeconds : null,
        maxGapNs: null,
        status: "unknown"
      };
    });
}

function mergeTopicTimeRanges(topics: readonly TopicCatalogEntry[]): TimeRange {
  return {
    startNs: minNullable(topics.map((topic) => topic.timeRange.startNs)),
    endNs: maxNullable(topics.map((topic) => topic.timeRange.endNs))
  };
}

function valueAsString(value: SqlValue | undefined): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function valueAsNullableString(value: SqlValue | undefined): string | null {
  const stringValue = valueAsString(value);
  return stringValue.length > 0 ? stringValue : null;
}

function valueAsNumber(value: SqlValue | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  return null;
}

function minNullable(values: readonly (number | null)[]): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finiteValues.length > 0 ? Math.min(...finiteValues) : null;
}

function maxNullable(values: readonly (number | null)[]): number | null {
  const finiteValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
