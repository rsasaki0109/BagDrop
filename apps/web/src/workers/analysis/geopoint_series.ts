import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicGeopoint } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import { decodeSensorMsgsNavSatFixLatLon } from "../moonbit/cdr";
import { downsampleTrajectorySeries } from "./trajectory_series";

export type { TopicGeopoint };

export const GEOPOINT_SERIES_MAX_POINTS = 2000;

class GeopointSeriesCollector {
  private readonly points: TopicGeopoint[] = [];

  consumeBatch(batch: TopicMessageBatch): void {
    if (batch.topicType !== "sensor_msgs/msg/NavSatFix") {
      return;
    }

    for (const encodedPayload of batch.payloadsBase64) {
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const position = decodeSensorMsgsNavSatFixLatLon(payload);
        if (position) {
          this.points.push(position);
        }
      } catch {
        // Ignore malformed payloads during geopoint extraction.
      }
    }
  }

  finalize(): TopicGeopoint[] {
    const downsampled = downsampleTrajectorySeries(
      this.points.map((point) => ({ x: point.lon, y: point.lat })),
      GEOPOINT_SERIES_MAX_POINTS
    );

    return downsampled.map((point) => ({ lat: point.y, lon: point.x }));
  }
}

export class GeopointSeriesRegistry {
  private readonly collectors = new Map<string, GeopointSeriesCollector>();

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new GeopointSeriesCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);
  }

  finalize(): Map<string, TopicGeopoint[]> {
    const result = new Map<string, TopicGeopoint[]>();

    for (const [topicName, collector] of this.collectors) {
      const points = collector.finalize();
      if (points.length > 0) {
        result.set(topicName, points);
      }
    }

    return result;
  }
}
