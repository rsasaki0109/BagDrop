import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicValuePoint } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import { decodeStdMsgsFloat32, decodeStdMsgsFloat64, decodeStdMsgsInt32, decodeStdMsgsUInt32, decodeGeometryMsgsTwistStampedAngularZ, decodeGeometryMsgsTwistStampedLinearX, decodeGeometryMsgsTwistWithCovarianceStampedAngularZ, decodeGeometryMsgsTwistWithCovarianceStampedLinearX, decodeSensorMsgsImuAngularVelocityMagnitude, decodeSensorMsgsImuLinearAccelMagnitude, decodeSensorMsgsLaserScanMinRange } from "../moonbit/cdr";

export type { TopicValuePoint };

export const VALUE_SERIES_MAX_POINTS = 2000;

const VALUE_TOPIC_TYPES = new Set([
  "std_msgs/msg/Float32",
  "std_msgs/msg/Float64",
  "std_msgs/msg/Int32",
  "std_msgs/msg/UInt32",
  "geometry_msgs/msg/TwistStamped",
  "geometry_msgs/msg/TwistWithCovarianceStamped",
  "sensor_msgs/msg/Imu",
  "sensor_msgs/msg/LaserScan"
]);

function decodeScalarValue(topicType: string, payload: Uint8Array): number | null {
  if (topicType === "std_msgs/msg/Float64") {
    return decodeStdMsgsFloat64(payload);
  }

  if (topicType === "std_msgs/msg/Float32") {
    return decodeStdMsgsFloat32(payload);
  }

  if (topicType === "std_msgs/msg/Int32") {
    return decodeStdMsgsInt32(payload);
  }

  if (topicType === "std_msgs/msg/UInt32") {
    return decodeStdMsgsUInt32(payload);
  }

  if (topicType === "sensor_msgs/msg/Imu") {
    return decodeSensorMsgsImuLinearAccelMagnitude(payload);
  }

  if (topicType === "geometry_msgs/msg/TwistStamped") {
    return decodeGeometryMsgsTwistStampedLinearX(payload);
  }

  if (topicType === "geometry_msgs/msg/TwistWithCovarianceStamped") {
    return decodeGeometryMsgsTwistWithCovarianceStampedLinearX(payload);
  }

  if (topicType === "sensor_msgs/msg/LaserScan") {
    return decodeSensorMsgsLaserScanMinRange(payload);
  }

  return null;
}

export function downsampleValueSeries(
  points: readonly TopicValuePoint[],
  maxPoints: number
): TopicValuePoint[] {
  if (points.length <= maxPoints) {
    return [...points];
  }

  const result: TopicValuePoint[] = [];
  const stride = points.length / maxPoints;

  for (let index = 0; index < maxPoints; index += 1) {
    result.push(points[Math.floor(index * stride)]);
  }

  return result;
}

class ValueSeriesCollector {
  private readonly points: TopicValuePoint[] = [];

  consumeBatch(batch: TopicMessageBatch): void {
    if (!VALUE_TOPIC_TYPES.has(batch.topicType)) {
      return;
    }

    for (let index = 0; index < batch.timestampsNs.length; index += 1) {
      const encodedPayload = batch.payloadsBase64[index];
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const value = decodeScalarValue(batch.topicType, payload);
        if (value !== null) {
          this.points.push({
            timestampNs: batch.timestampsNs[index],
            value
          });
        }
      } catch {
        // Ignore malformed payloads during value extraction.
      }
    }
  }

  finalize(): TopicValuePoint[] {
    return downsampleValueSeries(this.points, VALUE_SERIES_MAX_POINTS);
  }
}

class AngularSeriesCollector {
  private readonly points: TopicValuePoint[] = [];

  consumeBatch(batch: TopicMessageBatch): void {
    const decodeAngularValue =
      batch.topicType === "sensor_msgs/msg/Imu"
        ? decodeSensorMsgsImuAngularVelocityMagnitude
        : batch.topicType === "geometry_msgs/msg/TwistStamped"
          ? decodeGeometryMsgsTwistStampedAngularZ
          : batch.topicType === "geometry_msgs/msg/TwistWithCovarianceStamped"
            ? decodeGeometryMsgsTwistWithCovarianceStampedAngularZ
            : null;

    if (!decodeAngularValue) {
      return;
    }

    for (let index = 0; index < batch.timestampsNs.length; index += 1) {
      const encodedPayload = batch.payloadsBase64[index];
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const value = decodeAngularValue(payload);
        if (value !== null) {
          this.points.push({
            timestampNs: batch.timestampsNs[index],
            value
          });
        }
      } catch {
        // Ignore malformed payloads during value extraction.
      }
    }
  }

  finalize(): TopicValuePoint[] {
    return downsampleValueSeries(this.points, VALUE_SERIES_MAX_POINTS);
  }
}

export class ValueSeriesRegistry {
  private readonly collectors = new Map<string, ValueSeriesCollector>();
  private readonly angularVelocityCollectors = new Map<string, AngularSeriesCollector>();

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new ValueSeriesCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);

    if (
      batch.topicType === "sensor_msgs/msg/Imu" ||
      batch.topicType === "geometry_msgs/msg/TwistStamped" ||
      batch.topicType === "geometry_msgs/msg/TwistWithCovarianceStamped"
    ) {
      let angularCollector = this.angularVelocityCollectors.get(batch.topicName);
      if (!angularCollector) {
        angularCollector = new AngularSeriesCollector();
        this.angularVelocityCollectors.set(batch.topicName, angularCollector);
      }

      angularCollector.consumeBatch(batch);
    }
  }

  finalize(): Map<string, TopicValuePoint[]> {
    const result = new Map<string, TopicValuePoint[]>();

    for (const [topicName, collector] of this.collectors) {
      const points = collector.finalize();
      if (points.length > 0) {
        result.set(topicName, points);
      }
    }

    return result;
  }

  finalizeAngularVelocities(): Map<string, TopicValuePoint[]> {
    const result = new Map<string, TopicValuePoint[]>();

    for (const [topicName, collector] of this.angularVelocityCollectors) {
      const points = collector.finalize();
      if (points.length > 0) {
        result.set(topicName, points);
      }
    }

    return result;
  }
}
