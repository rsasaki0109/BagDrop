import type { Finding } from "../../model/result";
import type { TopicMessageBatch } from "../../model/message_batch";
import {
  MOONBIT_BATCH_CODEC_VERSION,
  type MoonBitAnalysisResult,
  type MoonBitCoreConfig,
  type MoonBitTopicRegistration,
  type MoonBitTopicResult
} from "./types";

export function encodeMoonBitCoreConfig(config: MoonBitCoreConfig): Uint8Array {
  return encodeJson({
    v: MOONBIT_BATCH_CODEC_VERSION,
    timeBasis: config.timeBasis
  });
}

export function encodeMoonBitTopicRegistration(topic: MoonBitTopicRegistration): Uint8Array {
  return encodeJson({
    v: MOONBIT_BATCH_CODEC_VERSION,
    catalogId: topic.catalogId,
    name: topic.name,
    type: topic.type,
    serializationFormat: topic.serializationFormat,
    catalogCount: topic.catalogCount
  });
}

export function encodeTopicMessageBatch(batch: TopicMessageBatch): Uint8Array {
  return encodeJson({
    v: MOONBIT_BATCH_CODEC_VERSION,
    topicName: batch.topicName,
    topicType: batch.topicType,
    serializationFormat: batch.serializationFormat,
    timestampsNs: batch.timestampsNs,
    payloadSizesBytes: batch.payloadSizesBytes
  });
}

export function decodeTopicMessageBatch(bytes: Uint8Array): TopicMessageBatch {
  const payload = decodeJson(bytes) as {
    topicName?: unknown;
    topicType?: unknown;
    serializationFormat?: unknown;
    timestampsNs?: unknown;
    payloadSizesBytes?: unknown;
  };

  return {
    topicName: asString(payload.topicName),
    topicType: asString(payload.topicType),
    serializationFormat: asNullableString(payload.serializationFormat),
    timestampsNs: asNumberArray(payload.timestampsNs),
    payloadSizesBytes: asNumberArray(payload.payloadSizesBytes)
  };
}

export function decodeMoonBitAnalysisResult(bytes: Uint8Array): MoonBitAnalysisResult {
  const payload = decodeJson(bytes) as {
    topics?: unknown;
    findings?: unknown;
    batchesConsumed?: unknown;
  };

  return {
    topics: asTopicResults(payload.topics),
    findings: asFindings(payload.findings),
    batchesConsumed: asFiniteNumber(payload.batchesConsumed) ?? 0
  };
}

export function decodeMoonBitTopicRegistration(bytes: Uint8Array): MoonBitTopicRegistration {
  const payload = decodeJson(bytes) as {
    catalogId?: unknown;
    name?: unknown;
    type?: unknown;
    serializationFormat?: unknown;
    catalogCount?: unknown;
  };

  return {
    catalogId: asFiniteNumber(payload.catalogId) ?? 0,
    name: asString(payload.name),
    type: asString(payload.type),
    serializationFormat: asNullableString(payload.serializationFormat),
    catalogCount: asNullableFiniteNumber(payload.catalogCount)
  };
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  const stringValue = asString(value);
  return stringValue.length > 0 ? stringValue : null;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function asTopicResults(value: unknown): MoonBitTopicResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const topic = entry as Record<string, unknown>;
      const name = asString(topic.name);
      if (name.length === 0) {
        return null;
      }

      return {
        name,
        messageCount: asFiniteNumber(topic.messageCount) ?? 0,
        maxGapNs: asNullableFiniteNumber(topic.maxGapNs),
        meanRateHz: asNullableFiniteNumber(topic.meanRateHz),
        status: asTopicStatus(topic.status)
      };
    })
    .filter((entry): entry is MoonBitTopicResult => entry !== null);
}

function asFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const findings: Finding[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const finding = entry as Record<string, unknown>;
    const id = asString(finding.id);
    const severity = asString(finding.severity);
    const title = asString(finding.title);
    const detail = asString(finding.detail);
    if (id.length === 0 || severity.length === 0 || title.length === 0 || detail.length === 0) {
      continue;
    }

    findings.push({
      id,
      severity: severity as Finding["severity"],
      title,
      detail,
      ...(asOptionalString(finding.topic) ? { topic: asOptionalString(finding.topic) } : {}),
      ...(asOptionalTimeBasis(finding.timeBasis)
        ? { timeBasis: asOptionalTimeBasis(finding.timeBasis) }
        : {}),
      ...(typeof finding.evidence === "object" && finding.evidence !== null
        ? { evidence: finding.evidence as Record<string, unknown> }
        : {})
    });
  }

  return findings;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableFiniteNumber(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  return asFiniteNumber(value);
}

function asOptionalString(value: unknown): string | undefined {
  const stringValue = asString(value);
  return stringValue.length > 0 ? stringValue : undefined;
}

function asOptionalTimeBasis(value: unknown): Finding["timeBasis"] | undefined {
  return value === "record_time" || value === "source_time" ? value : undefined;
}

function asTopicStatus(value: unknown): MoonBitTopicResult["status"] {
  return value === "warning" || value === "error" ? value : "ok";
}
