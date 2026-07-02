import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicValuePoint } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import { decodeStdMsgsFloat32, decodeStdMsgsFloat64 } from "../moonbit/cdr";

export type { TopicValuePoint };

export const VALUE_SERIES_MAX_POINTS = 2000;

const VALUE_TOPIC_TYPES = new Set(["std_msgs/msg/Float32", "std_msgs/msg/Float64"]);

function decodeScalarValue(topicType: string, payload: Uint8Array): number | null {
  if (topicType === "std_msgs/msg/Float64") {
    return decodeStdMsgsFloat64(payload);
  }

  if (topicType === "std_msgs/msg/Float32") {
    return decodeStdMsgsFloat32(payload);
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

export class ValueSeriesRegistry {
  private readonly collectors = new Map<string, ValueSeriesCollector>();

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new ValueSeriesCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);
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
}
