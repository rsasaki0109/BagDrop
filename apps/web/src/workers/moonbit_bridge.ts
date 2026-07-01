export interface MoonBitCoreAbi {
  core_create(configPtr: number, configLen: number): number;
  core_register_topic(handle: number, topicPtr: number, topicLen: number): number;
  core_consume_batch(handle: number, batchPtr: number, batchLen: number): number;
  core_finish(handle: number): number;
  core_result_ptr(resultHandle: number): number;
  core_result_len(resultHandle: number): number;
  core_free_result(resultHandle: number): void;
  core_destroy(handle: number): void;
}

export interface MoonBitCoreInstance {
  memory: WebAssembly.Memory;
  exports: MoonBitCoreAbi;
}

export async function instantiateMoonBitCore(wasmUrl: URL): Promise<MoonBitCoreInstance> {
  const instance = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
  const exports = instance.instance.exports;

  if (!(exports.memory instanceof WebAssembly.Memory)) {
    throw new Error("MoonBit core Wasm does not export linear memory.");
  }

  return {
    memory: exports.memory,
    exports: assertMoonBitAbi(exports)
  };
}

function assertMoonBitAbi(exports: WebAssembly.Exports): MoonBitCoreAbi {
  const names: Array<keyof MoonBitCoreAbi> = [
    "core_create",
    "core_register_topic",
    "core_consume_batch",
    "core_finish",
    "core_result_ptr",
    "core_result_len",
    "core_free_result",
    "core_destroy"
  ];

  for (const name of names) {
    if (typeof exports[name] !== "function") {
      throw new Error(`MoonBit core Wasm missing export: ${name}`);
    }
  }

  return exports as unknown as MoonBitCoreAbi;
}
