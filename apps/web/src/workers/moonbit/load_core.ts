import type { TopicCatalogEntry } from "../../model/result";
import type { TopicMessageBatch } from "../../model/message_batch";
import { instantiateMoonBitCore } from "../moonbit_bridge";
import {
  MOONBIT_CORE_STATUS_OK,
  type MoonBitAnalysisResult,
  type MoonBitCoreBackend,
  type MoonBitCoreConfig
} from "./types";
import { catalogTopicToRegistration, TypeScriptMoonBitCoreBackend } from "./typescript_backend";
import { WasmMoonBitCoreBackend } from "./wasm_backend";

export interface MoonBitCoreSession {
  readonly backendKind: MoonBitCoreBackend["kind"];
  registerTopics(topics: readonly TopicCatalogEntry[]): void;
  consumeBatch(batch: TopicMessageBatch): void;
  finish(): MoonBitAnalysisResult;
}

function moonBitWasmOrigin(): string {
  return typeof self !== "undefined" && "location" in self
    ? self.location.origin
    : "http://127.0.0.1";
}

function moonBitWasmCandidates(baseUrl: string): URL[] {
  const origin = moonBitWasmOrigin();
  return [
    new URL(`${baseUrl}moon/core.wasm`, origin),
    new URL(`${baseUrl}moon/core.stub.wasm`, origin)
  ];
}

async function resolveMoonBitWasmUrl(preferred?: URL): Promise<URL | null> {
  if (preferred) {
    return preferred;
  }

  const baseUrl = import.meta.env.BASE_URL;
  for (const candidate of moonBitWasmCandidates(baseUrl)) {
    try {
      const response = await fetch(candidate, { method: "HEAD" });
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

export async function createMoonBitCoreSession(
  wasmUrl?: URL
): Promise<MoonBitCoreSession> {
  const resolvedWasmUrl = await resolveMoonBitWasmUrl(wasmUrl);
  const config: MoonBitCoreConfig = {
    timeBasis: "record_time"
  };

  let backend: MoonBitCoreBackend = new TypeScriptMoonBitCoreBackend();

  if (resolvedWasmUrl) {
    try {
      const instance = await instantiateMoonBitCore(resolvedWasmUrl);
      backend = new WasmMoonBitCoreBackend(instance);
    } catch {
      backend = new TypeScriptMoonBitCoreBackend();
    }
  }

  const handle = backend.create(config);

  return {
    backendKind: backend.kind,
    registerTopics(topics) {
      for (const topic of topics) {
        const status = backend.registerTopic(handle, catalogTopicToRegistration(topic));
        if (status !== MOONBIT_CORE_STATUS_OK) {
          throw new Error(`MoonBit core rejected topic registration for ${topic.name}.`);
        }
      }
    },
    consumeBatch(batch) {
      const status = backend.consumeBatch(handle, batch);
      if (status !== MOONBIT_CORE_STATUS_OK) {
        throw new Error(`MoonBit core rejected batch for ${batch.topicName}.`);
      }
    },
    finish() {
      const result = backend.finish(handle);
      backend.destroy(handle);
      return result;
    }
  };
}
