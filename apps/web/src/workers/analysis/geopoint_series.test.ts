import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalSensorMsgsNavSatFixPayload } from "../moonbit/cdr";
import { GeopointSeriesRegistry } from "./geopoint_series";

describe("GeopointSeriesRegistry", () => {
  it("extracts navsatfix latitude and longitude from payloads", () => {
    const registry = new GeopointSeriesRegistry();
    const payload = buildMinimalSensorMsgsNavSatFixPayload({ lat: 35.6812, lon: 139.7671 });
    const batch: TopicMessageBatch = {
      topicName: "/fix",
      topicType: "sensor_msgs/msg/NavSatFix",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload)]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/fix")).toEqual([{ lat: 35.6812, lon: 139.7671 }]);
  });
});
