import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicScanProfile } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import { decodeSensorMsgsLaserScanProfile } from "../moonbit/cdr";

export type { TopicScanProfile };

class ScanProfileCollector {
  private latest: TopicScanProfile | null = null;

  consumeBatch(batch: TopicMessageBatch): void {
    if (batch.topicType !== "sensor_msgs/msg/LaserScan") {
      return;
    }

    for (let index = 0; index < batch.timestampsNs.length; index += 1) {
      const encodedPayload = batch.payloadsBase64[index];
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const profile = decodeSensorMsgsLaserScanProfile(payload);
        if (!profile) {
          continue;
        }

        this.latest = {
          timestampNs: batch.timestampsNs[index],
          angleMin: profile.angleMin,
          angleIncrement: profile.angleIncrement,
          ranges: profile.ranges
        };
      } catch {
        // Ignore malformed payloads during scan profile extraction.
      }
    }
  }

  finalize(): TopicScanProfile | null {
    return this.latest;
  }
}

export class ScanProfileSeriesRegistry {
  private readonly collectors = new Map<string, ScanProfileCollector>();

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new ScanProfileCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);
  }

  finalize(): Map<string, TopicScanProfile> {
    const result = new Map<string, TopicScanProfile>();

    for (const [topicName, collector] of this.collectors) {
      const profile = collector.finalize();
      if (profile) {
        result.set(topicName, profile);
      }
    }

    return result;
  }
}
