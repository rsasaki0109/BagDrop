import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalStdMsgsFloat32Payload, buildMinimalStdMsgsFloat64Payload, buildMinimalStdMsgsInt32Payload, buildMinimalStdMsgsUInt32Payload, buildMinimalGeometryMsgsTwistStampedPayload, buildMinimalSensorMsgsImuPayload, buildMinimalSensorMsgsLaserScanPayload } from "../moonbit/cdr";
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

  it("extracts std_msgs/msg/Float32 values with timestamps", () => {
    const registry = new ValueSeriesRegistry();
    const payload = buildMinimalStdMsgsFloat32Payload(21.5);
    const batch: TopicMessageBatch = {
      topicName: "/speed",
      topicType: "std_msgs/msg/Float32",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [payload.length, payload.length],
      payloadsBase64: [
        uint8ArrayToBase64(payload),
        uint8ArrayToBase64(buildMinimalStdMsgsFloat32Payload(22.5))
      ]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/speed")).toEqual([
      { timestampNs: 1_000_000_000, value: 21.5 },
      { timestampNs: 2_000_000_000, value: 22.5 }
    ]);
  });

  it("extracts std_msgs/msg/Int32 and UInt32 values with timestamps", () => {
    const registry = new ValueSeriesRegistry();
    const intBatch: TopicMessageBatch = {
      topicName: "/counter",
      topicType: "std_msgs/msg/Int32",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [8],
      payloadsBase64: [uint8ArrayToBase64(buildMinimalStdMsgsInt32Payload(12))]
    };
    const uintBatch: TopicMessageBatch = {
      topicName: "/flags",
      topicType: "std_msgs/msg/UInt32",
      serializationFormat: "cdr",
      timestampsNs: [2_000_000_000],
      payloadSizesBytes: [8],
      payloadsBase64: [uint8ArrayToBase64(buildMinimalStdMsgsUInt32Payload(99))]
    };

    registry.consumeBatch(intBatch);
    registry.consumeBatch(uintBatch);

    const result = registry.finalize();
    expect(result.get("/counter")).toEqual([{ timestampNs: 1_000_000_000, value: 12 }]);
    expect(result.get("/flags")).toEqual([{ timestampNs: 2_000_000_000, value: 99 }]);
  });

  it("extracts sensor_msgs/msg/Imu linear acceleration magnitudes", () => {
    const registry = new ValueSeriesRegistry();
    const payload = buildMinimalSensorMsgsImuPayload({ ax: 3, ay: 4, az: 0 });
    const batch: TopicMessageBatch = {
      topicName: "/imu",
      topicType: "sensor_msgs/msg/Imu",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload)]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/imu")).toEqual([{ timestampNs: 1_000_000_000, value: 5 }]);
  });

  it("extracts geometry_msgs/msg/TwistStamped linear x values", () => {
    const registry = new ValueSeriesRegistry();
    const payload = buildMinimalGeometryMsgsTwistStampedPayload({ linearX: 1.25 });
    const batch: TopicMessageBatch = {
      topicName: "/cmd_vel",
      topicType: "geometry_msgs/msg/TwistStamped",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [payload.length, payload.length],
      payloadsBase64: [
        uint8ArrayToBase64(payload),
        uint8ArrayToBase64(buildMinimalGeometryMsgsTwistStampedPayload({ linearX: 0.75 }))
      ]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/cmd_vel")).toEqual([
      { timestampNs: 1_000_000_000, value: 1.25 },
      { timestampNs: 2_000_000_000, value: 0.75 }
    ]);
  });

  it("extracts sensor_msgs/msg/LaserScan minimum ranges", () => {
    const registry = new ValueSeriesRegistry();
    const payload = buildMinimalSensorMsgsLaserScanPayload([2.5, 1.0, 4.0]);
    const batch: TopicMessageBatch = {
      topicName: "/scan",
      topicType: "sensor_msgs/msg/LaserScan",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [payload.length, payload.length],
      payloadsBase64: [
        uint8ArrayToBase64(payload),
        uint8ArrayToBase64(buildMinimalSensorMsgsLaserScanPayload([3.0, 0.5]))
      ]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/scan")).toEqual([
      { timestampNs: 1_000_000_000, value: 1 },
      { timestampNs: 2_000_000_000, value: 0.5 }
    ]);
  });
});
