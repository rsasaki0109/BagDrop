import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BagCatalog } from "../../src/model/result";
import { catalogTopicToRegistration, TypeScriptMoonBitCoreBackend } from "../../src/workers/moonbit/typescript_backend";
import { MOONBIT_CORE_STATUS_OK } from "../../src/workers/moonbit/types";
import { WasmMoonBitCoreBackend } from "../../src/workers/moonbit/wasm_backend";

export async function createWasmMoonBitCoreSession() {
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
