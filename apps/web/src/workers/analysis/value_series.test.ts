import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalStdMsgsFloat64Payload } from "../moonbit/cdr";
import { downsampleValueSeries, ValueSeriesRegistry } from "./value_series";

describe("ValueSeriesRegistry", () => {
  it("extracts std_msgs/msg/Float64 values with timestamps", () => {
    const registry = new ValueSeriesRegistry();
    const payload = buildMinimalStdMsgsFloat64Payload(42);
    const batch: TopicMessageBatch = {
      topicName: "/temperature",
      topicType: "std_msgs/msg/Float64",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [payload.length, payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload), uint8ArrayToBase64(buildMinimalStdMsgsFloat64Payload(43))]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/temperature")).toEqual([
      { timestampNs: 1_000_000_000, value: 42 },
      { timestampNs: 2_000_000_000, value: 43 }
    ]);
  });

  it("downsamples long value series", () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      timestampNs: index * 1_000_000_000,
      value: index
    }));

    expect(downsampleValueSeries(points, 4)).toEqual([
      { timestampNs: 0, value: 0 },
      { timestampNs: 2_000_000_000, value: 2 },
      { timestampNs: 5_000_000_000, value: 5 },
      { timestampNs: 7_000_000_000, value: 7 }
    ]);
  });
});
