import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { catalogTopicToRegistration } from "./typescript_backend";
import { WasmMoonBitCoreBackend } from "./wasm_backend";

const coreWasmPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../public/moon/core.wasm"
);

describe("WasmMoonBitCoreBackend", () => {
  it("returns stream findings from the MoonBit core wasm module", () => {
    const wasmBytes = readFileSync(coreWasmPath);
    const instance = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes), {});
    const backend = new WasmMoonBitCoreBackend({
      memory: instance.exports.memory as WebAssembly.Memory,
      exports: instance.exports as never
    });

    const handle = backend.create({ timeBasis: "record_time" });
    expect(
      backend.registerTopic(
        handle,
        catalogTopicToRegistration({
          id: 0,
          name: "/odom",
          type: "nav_msgs/msg/Odometry",
          serializationFormat: "cdr",
          count: 3,
          timeRange: { startNs: null, endNs: null },
          meanRateHz: null,
          maxGapNs: null,
          status: "unknown"
        })
      )
    ).toBe(0);

    expect(
      backend.consumeBatch(handle, {
        topicName: "/odom",
        topicType: "nav_msgs/msg/Odometry",
        serializationFormat: "cdr",
        timestampsNs: [1_000_000_000, 2_000_000_000],
        payloadSizesBytes: [1, 1],
        payloadsBase64: ["", ""]
      })
    ).toBe(0);

    const result = backend.finish(handle);
    backend.destroy(handle);

    expect(result.topics).toEqual([
      expect.objectContaining({
        name: "/odom",
        messageCount: 2,
        status: "error"
      })
    ]);
    expect(result.findings).toEqual([
      expect.objectContaining({
        id: "stream-count-mismatch-0",
        severity: "error",
        topic: "/odom"
      })
    ]);
    expect(result.batchesConsumed).toBe(1);
  });
});
