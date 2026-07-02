import { describe, expect, it } from "vitest";
import { downsampleIntervalSeries, type TopicIntervalPoint } from "./interval_series";

describe("downsampleIntervalSeries", () => {
  it("keeps small series unchanged", () => {
    const points: TopicIntervalPoint[] = [
      { timestampNs: 1_000_000_000, deltaNs: 500_000_000 },
      { timestampNs: 2_000_000_000, deltaNs: 1_000_000_000 }
    ];

    expect(downsampleIntervalSeries(points, 10)).toEqual(points);
  });

  it("preserves the largest gap in each time bucket", () => {
    const points: TopicIntervalPoint[] = [
      { timestampNs: 0, deltaNs: 100_000_000 },
      { timestampNs: 1_000_000_000, deltaNs: 6_000_000_000 },
      { timestampNs: 2_000_000_000, deltaNs: 200_000_000 }
    ];

    expect(downsampleIntervalSeries(points, 2)).toEqual([
      { timestampNs: 0, deltaNs: 100_000_000 },
      { timestampNs: 1_000_000_000, deltaNs: 6_000_000_000 }
    ]);
  });
});

describe("IntervalSeriesRegistry", () => {
  it("does not connect intervals across segment boundaries", async () => {
    const { IntervalSeriesRegistry } = await import("./interval_series");
    const registry = new IntervalSeriesRegistry();

    registry.consumeBatch({
      topicName: "/scan",
      topicType: "sensor_msgs/msg/LaserScan",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [1],
      payloadsBase64: [""]
    });

    registry.beginSegment();
    registry.consumeBatch({
      topicName: "/scan",
      topicType: "sensor_msgs/msg/LaserScan",
      serializationFormat: "cdr",
      timestampsNs: [8_000_000_000],
      payloadSizesBytes: [1],
      payloadsBase64: [""]
    });

    expect(registry.finalize().get("/scan")).toEqual([]);
  });
});
