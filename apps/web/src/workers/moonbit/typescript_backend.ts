import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicCatalogEntry } from "../../model/result";
import {
  buildStreamFindings,
  topicStatusFromSnapshot,
  type StreamTopicSnapshot
} from "./stream_findings";
import {
  MOONBIT_CORE_STATUS_OK,
  type MoonBitAnalysisResult,
  type MoonBitCoreBackend,
  type MoonBitCoreConfig,
  type MoonBitTopicRegistration,
  type MoonBitTopicResult
} from "./types";

interface TopicAccumulator {
  registration: MoonBitTopicRegistration;
  messageCount: number;
  minTimestampNs: number | null;
  maxTimestampNs: number | null;
  maxGapNs: number | null;
  previousTimestampNs: number | null;
}

export class TypeScriptMoonBitCoreBackend implements MoonBitCoreBackend {
  readonly kind = "typescript" as const;

  private readonly topics = new Map<string, TopicAccumulator>();
  private batchesConsumed = 0;
  private activeHandle: number | null = null;

  create(_config: MoonBitCoreConfig): number {
    this.activeHandle = 1;
    this.topics.clear();
    this.batchesConsumed = 0;
    return this.activeHandle;
  }

  registerTopic(handle: number, topic: MoonBitTopicRegistration): number {
    if (!this.isActiveHandle(handle)) {
      return 1;
    }

    this.topics.set(topic.name, {
      registration: topic,
      messageCount: 0,
      minTimestampNs: null,
      maxTimestampNs: null,
      maxGapNs: null,
      previousTimestampNs: null
    });
    return MOONBIT_CORE_STATUS_OK;
  }

  consumeBatch(handle: number, batch: TopicMessageBatch): number {
    if (!this.isActiveHandle(handle)) {
      return 1;
    }

    const topic = this.topics.get(batch.topicName);
    if (!topic) {
      return 2;
    }

    for (let index = 0; index < batch.timestampsNs.length; index += 1) {
      const timestampNs = batch.timestampsNs[index];
      topic.messageCount += 1;
      topic.minTimestampNs =
        topic.minTimestampNs === null ? timestampNs : Math.min(topic.minTimestampNs, timestampNs);
      topic.maxTimestampNs =
        topic.maxTimestampNs === null ? timestampNs : Math.max(topic.maxTimestampNs, timestampNs);

      if (topic.previousTimestampNs !== null) {
        const gapNs = timestampNs - topic.previousTimestampNs;
        topic.maxGapNs = topic.maxGapNs === null ? gapNs : Math.max(topic.maxGapNs, gapNs);
      }

      topic.previousTimestampNs = timestampNs;
    }

    this.batchesConsumed += 1;
    return MOONBIT_CORE_STATUS_OK;
  }

  finish(handle: number): MoonBitAnalysisResult {
    if (!this.isActiveHandle(handle)) {
      return {
        topics: [],
        findings: [],
        batchesConsumed: this.batchesConsumed
      };
    }

    const accumulators = [...this.topics.values()];
    const snapshots = accumulators.map((topic) => toSnapshot(topic));

    return {
      topics: accumulators.map((topic) => toTopicResult(topic)),
      findings: buildStreamFindings(snapshots),
      batchesConsumed: this.batchesConsumed
    };
  }

  destroy(handle: number): void {
    if (this.activeHandle === handle) {
      this.activeHandle = null;
      this.topics.clear();
      this.batchesConsumed = 0;
    }
  }

  private isActiveHandle(handle: number): boolean {
    return this.activeHandle === handle;
  }
}

export function catalogTopicToRegistration(topic: TopicCatalogEntry): MoonBitTopicRegistration {
  return {
    catalogId: topic.id,
    name: topic.name,
    type: topic.type,
    serializationFormat: topic.serializationFormat,
    catalogCount: topic.count
  };
}

function toSnapshot(topic: TopicAccumulator): StreamTopicSnapshot {
  return {
    catalogId: topic.registration.catalogId,
    name: topic.registration.name,
    messageCount: topic.messageCount,
    catalogCount: topic.registration.catalogCount,
    maxGapNs: topic.maxGapNs
  };
}

function toTopicResult(topic: TopicAccumulator): MoonBitTopicResult {
  const snapshot = toSnapshot(topic);
  const durationSeconds =
    topic.minTimestampNs === null ||
    topic.maxTimestampNs === null ||
    topic.maxTimestampNs <= topic.minTimestampNs
      ? null
      : (topic.maxTimestampNs - topic.minTimestampNs) / 1_000_000_000;

  return {
    name: snapshot.name,
    messageCount: snapshot.messageCount,
    maxGapNs: snapshot.maxGapNs,
    meanRateHz:
      durationSeconds && durationSeconds > 0 ? snapshot.messageCount / durationSeconds : null,
    status: topicStatusFromSnapshot(snapshot)
  };
}
