import type { MoonBitCoreAbi, MoonBitCoreInstance } from "../moonbit_bridge";
import type { TopicMessageBatch } from "../../model/message_batch";
import {
  decodeMoonBitAnalysisResult,
  encodeMoonBitCoreConfig,
  encodeMoonBitTopicRegistration,
  encodeTopicMessageBatch
} from "./batch_codec";
import {
  MOONBIT_CORE_STATUS_OK,
  type MoonBitAnalysisResult,
  type MoonBitCoreBackend,
  type MoonBitCoreConfig,
  type MoonBitTopicRegistration
} from "./types";

const MOONBIT_CORE_FINISH_OK = 1;

export class WasmMoonBitCoreBackend implements MoonBitCoreBackend {
  readonly kind = "wasm" as const;

  private readonly exports: MoonBitCoreAbi;
  private readonly memory: WebAssembly.Memory;
  private allocationOffset = 1024;
  private handle: number | null = null;

  constructor(instance: MoonBitCoreInstance) {
    this.exports = instance.exports;
    this.memory = instance.memory;
  }

  create(config: MoonBitCoreConfig): number {
    const encoded = encodeMoonBitCoreConfig(config);
    const { pointer, length } = this.writeBytes(encoded);
    const handle = this.exports.core_create(pointer, length);
    this.handle = handle;
    return handle;
  }

  registerTopic(handle: number, topic: MoonBitTopicRegistration): number {
    const encoded = encodeMoonBitTopicRegistration(topic);
    const { pointer, length } = this.writeBytes(encoded);
    return this.exports.core_register_topic(handle, pointer, length);
  }

  consumeBatch(handle: number, batch: TopicMessageBatch): number {
    const encoded = encodeTopicMessageBatch(batch);
    const { pointer, length } = this.writeBytes(encoded);
    return this.exports.core_consume_batch(handle, pointer, length);
  }

  finish(handle: number): MoonBitAnalysisResult {
    const status = this.exports.core_finish(handle);
    if (status !== MOONBIT_CORE_FINISH_OK) {
      throw new Error("MoonBit core finish failed.");
    }

    const pointer = this.exports.core_result_ptr(handle);
    const length = this.exports.core_result_len(handle);
    if (length <= 0) {
      throw new Error("MoonBit core returned an empty result buffer.");
    }

    const memory = new Uint8Array(this.memory.buffer);
    const bytes = memory.slice(pointer, pointer + length);
    const result = decodeMoonBitAnalysisResult(bytes);
    this.exports.core_free_result(handle);
    return result;
  }

  destroy(handle: number): void {
    this.exports.core_destroy(handle);
    this.handle = null;
  }

  private writeBytes(bytes: Uint8Array): { pointer: number; length: number } {
    const memory = new Uint8Array(this.memory.buffer);
    const pointer = this.allocationOffset;
    const end = pointer + bytes.byteLength;

    if (end > memory.byteLength) {
      throw new Error("MoonBit core Wasm memory is full.");
    }

    memory.set(bytes, pointer);
    this.allocationOffset = align4(end);
    return {
      pointer,
      length: bytes.byteLength
    };
  }
}

function align4(value: number): number {
  return (value + 3) & ~3;
}
