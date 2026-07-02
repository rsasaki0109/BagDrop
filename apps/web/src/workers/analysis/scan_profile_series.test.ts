import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalSensorMsgsLaserScanPayload } from "../moonbit/cdr";
import { ScanProfileSeriesRegistry } from "./scan_profile_series";

describe("ScanProfileSeriesRegistry", () => {
  it("keeps the latest LaserScan profile per topic", () => {
    const registry = new ScanProfileSeriesRegistry();
    const firstPayload = buildMinimalSensorMsgsLaserScanPayload([1, 2]);
    const secondPayload = buildMinimalSensorMsgsLaserScanPayload([3, 4, 5]);
    const batch: TopicMessageBatch = {
      topicName: "/scan",
      topicType: "sensor_msgs/msg/LaserScan",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [firstPayload.length, secondPayload.length],
      payloadsBase64: [uint8ArrayToBase64(firstPayload), uint8ArrayToBase64(secondPayload)]
    };

    registry.consumeBatch(batch);

    const profile = registry.finalize().get("/scan");
    expect(profile?.timestampNs).toBe(2_000_000_000);
    expect(profile?.angleMin).toBe(-1);
    expect(profile?.angleIncrement).toBeCloseTo(0.1);
    expect(profile?.ranges).toEqual([3, 4, 5]);
  });
});
