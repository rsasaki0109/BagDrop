import type { Finding, TopicValuePoint } from "../../model/result";
import type { TopicMessageBatch } from "../../model/message_batch";

export const MOONBIT_BATCH_CODEC_VERSION = 1;
export const MOONBIT_CORE_STATUS_OK = 0;

export interface MoonBitCoreConfig {
  timeBasis: "record_time" | "source_time";
}

export interface MoonBitTopicRegistration {
  catalogId: number;
  name: string;
  type: string;
  serializationFormat: string | null;
  catalogCount: number | null;
}

export interface MoonBitTopicResult {
  name: string;
  messageCount: number;
  maxGapNs: number | null;
  meanRateHz: number | null;
  status: "ok" | "warning" | "error";
  decodedPayloads: number;
  decodeErrors: number;
  valueSeries?: TopicValuePoint[];
  angularVelocitySeries?: TopicValuePoint[];
}

export interface MoonBitAnalysisResult {
  topics: MoonBitTopicResult[];
  findings: Finding[];
  batchesConsumed: number;
}

export interface MoonBitCoreBackend {
  readonly kind: "typescript" | "wasm";
  create(config: MoonBitCoreConfig): number;
  registerTopic(handle: number, topic: MoonBitTopicRegistration): number;
  consumeBatch(handle: number, batch: TopicMessageBatch): number;
  finish(handle: number): MoonBitAnalysisResult;
  destroy(handle: number): void;
}

export type EncodedMoonBitPayload = Uint8Array;
