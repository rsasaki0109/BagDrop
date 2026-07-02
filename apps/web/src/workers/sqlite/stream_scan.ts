import type { Database, SqlValue } from "@sqlite.org/sqlite-wasm";
import type { TopicCatalogEntry } from "../../model/result";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";

export const STREAM_BATCH_SIZE = 1000;
export const LARGE_GAP_WARNING_NS = 5_000_000_000;

export interface TopicStreamStats {
  key: string;
  topicName: string;
  streamedCount: number;
  minTimestampNs: number | null;
  maxTimestampNs: number | null;
  maxGapNs: number | null;
  meanRateHz: number | null;
  batchesRead: number;
}

export interface SegmentStreamScanResult {
  stats: TopicStreamStats[];
}

export function catalogTopicKey(
  topic: Pick<TopicCatalogEntry, "name" | "type" | "serializationFormat">
): string {
  return [topic.name, topic.type, topic.serializationFormat ?? ""].join("\u0000");
}

export interface SegmentStreamScanOptions {
  onBatch?: (batch: TopicMessageBatch) => void;
}

export function scanSegmentTopicStreams(
  db: Database,
  catalogTopics: readonly TopicCatalogEntry[],
  options: SegmentStreamScanOptions = {}
): SegmentStreamScanResult {
  const catalogKeys = new Set(catalogTopics.map((topic) => catalogTopicKey(topic)));
  if (catalogKeys.size === 0) {
    return { stats: [] };
  }

  const topicRows = db.selectObjects(`
    SELECT
      id,
      name,
      type,
      serialization_format AS serializationFormat
    FROM topics
    ORDER BY id
  `);

  const stats: TopicStreamStats[] = [];

  for (const row of topicRows) {
    const topicName = valueAsString(row.name);
    const topicType = valueAsString(row.type);
    const serializationFormat = valueAsNullableString(row.serializationFormat);
    const key = catalogTopicKey({ name: topicName, type: topicType, serializationFormat });

    if (!catalogKeys.has(key)) {
      continue;
    }

    const topicId = valueAsNumber(row.id);
    if (topicId === null) {
      continue;
    }

    stats.push(
      streamTopicMessages(db, topicId, topicName, topicType, serializationFormat, key, options.onBatch)
    );
  }

  return { stats };
}

function streamTopicMessages(
  db: Database,
  topicId: number,
  topicName: string,
  topicType: string,
  serializationFormat: string | null,
  key: string,
  onBatch?: (batch: TopicMessageBatch) => void
): TopicStreamStats {
  let lastTimestamp = -1;
  let streamedCount = 0;
  let minTimestampNs: number | null = null;
  let maxTimestampNs: number | null = null;
  let maxGapNs: number | null = null;
  let previousTimestamp: number | null = null;
  let batchesRead = 0;

  while (true) {
    const rows = db.selectObjects(`
      SELECT
        timestamp,
        length(data) AS payloadSize,
        data AS payload
      FROM messages
      WHERE topic_id = ${topicId} AND timestamp > ${lastTimestamp}
      ORDER BY timestamp
      LIMIT ${STREAM_BATCH_SIZE}
    `);

    if (rows.length === 0) {
      break;
    }

    batchesRead += 1;
    const batch = rowsToMessageBatch(topicName, topicType, serializationFormat, rows);
    onBatch?.(batch);
    consumeMessageBatch(batch, {
      onTimestamp: (timestampNs) => {
        streamedCount += 1;
        minTimestampNs = minTimestampNs === null ? timestampNs : Math.min(minTimestampNs, timestampNs);
        maxTimestampNs = maxTimestampNs === null ? timestampNs : Math.max(maxTimestampNs, timestampNs);

        if (previousTimestamp !== null) {
          const gapNs = timestampNs - previousTimestamp;
          maxGapNs = maxGapNs === null ? gapNs : Math.max(maxGapNs, gapNs);
        }

        previousTimestamp = timestampNs;
        lastTimestamp = timestampNs;
      }
    });

    if (rows.length < STREAM_BATCH_SIZE) {
      break;
    }
  }

  const durationSeconds =
    minTimestampNs === null || maxTimestampNs === null || maxTimestampNs <= minTimestampNs
      ? null
      : (maxTimestampNs - minTimestampNs) / 1_000_000_000;

  return {
    key,
    topicName,
    streamedCount,
    minTimestampNs,
    maxTimestampNs,
    maxGapNs,
    meanRateHz: durationSeconds && durationSeconds > 0 ? streamedCount / durationSeconds : null,
    batchesRead
  };
}

export function consumeMessageBatch(
  batch: TopicMessageBatch,
  handlers: {
    onTimestamp: (timestampNs: number, payloadSizeBytes: number) => void;
  }
): void {
  for (let index = 0; index < batch.timestampsNs.length; index += 1) {
    handlers.onTimestamp(batch.timestampsNs[index], batch.payloadSizesBytes[index] ?? 0);
  }
}

function rowsToMessageBatch(
  topicName: string,
  topicType: string,
  serializationFormat: string | null,
  rows: Array<Record<string, SqlValue>>
): TopicMessageBatch {
  const timestampsNs: number[] = [];
  const payloadSizesBytes: number[] = [];
  const payloadsBase64: string[] = [];

  for (const row of rows) {
    const timestampNs = valueAsNumber(row.timestamp);
    if (timestampNs === null) {
      continue;
    }

    timestampsNs.push(timestampNs);
    payloadSizesBytes.push(valueAsNumber(row.payloadSize) ?? 0);
    payloadsBase64.push(sqlBlobToBase64(row.payload));
  }

  return {
    topicName,
    topicType,
    serializationFormat,
    timestampsNs,
    payloadSizesBytes,
    payloadsBase64
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

function sqlBlobToBase64(value: SqlValue | undefined): string {
  if (value instanceof Uint8Array) {
    return value.length > 0 ? uint8ArrayToBase64(value) : "";
  }

  if (value instanceof ArrayBuffer) {
    return uint8ArrayToBase64(new Uint8Array(value));
  }

  return "";
}
