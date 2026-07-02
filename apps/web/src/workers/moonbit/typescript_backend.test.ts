import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { TypeScriptMoonBitCoreBackend } from "./typescript_backend";

describe("TypeScriptMoonBitCoreBackend", () => {
  it("aggregates batch timestamps into topic results", () => {
    const backend = new TypeScriptMoonBitCoreBackend();
    const handle = backend.create({ timeBasis: "record_time" });

    expect(
      backend.registerTopic(handle, {
        catalogId: 0,
        name: "/odom",
        type: "nav_msgs/msg/Odometry",
        serializationFormat: "cdr",
        catalogCount: 3
      })
    ).toBe(0);

    consume(backend, handle, {
      topicName: "/odom",
      topicType: "nav_msgs/msg/Odometry",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000, 3_000_000_000],
      payloadSizesBytes: [1, 1, 1],
      payloadsBase64: ["", "", ""]
    });

    const result = backend.finish(handle);

    expect(result.batchesConsumed).toBe(1);
    expect(result.topics).toEqual([
      {
        name: "/odom",
        messageCount: 3,
        maxGapNs: 1_000_000_000,
        meanRateHz: 1.5,
        status: "ok",
        decodedPayloads: 0,
        decodeErrors: 0
      }
    ]);
    expect(result.findings).toEqual([]);
  });

  it("returns count mismatch findings from the core backend", () => {
    const backend = new TypeScriptMoonBitCoreBackend();
    const handle = backend.create({ timeBasis: "record_time" });

    backend.registerTopic(handle, {
      catalogId: 2,
      name: "/fix",
      type: "sensor_msgs/msg/NavSatFix",
      serializationFormat: "cdr",
      catalogCount: 5
    });

    consume(backend, handle, {
      topicName: "/fix",
      topicType: "sensor_msgs/msg/NavSatFix",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [1],
      payloadsBase64: [""]
    });

    const result = backend.finish(handle);

    expect(result.topics[0]?.status).toBe("error");
    expect(result.findings).toEqual([
      expect.objectContaining({
        id: "stream-count-mismatch-2",
        severity: "error",
        topic: "/fix"
      })
    ]);
  });
});

function consume(
  backend: TypeScriptMoonBitCoreBackend,
  handle: number,
  batch: TopicMessageBatch
): void {
  expect(backend.consumeBatch(handle, batch)).toBe(0);
}
