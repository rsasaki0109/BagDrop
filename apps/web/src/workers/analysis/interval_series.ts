import type { TopicMessageBatch } from "../../model/message_batch";
import { LARGE_GAP_WARNING_NS } from "../moonbit/stream_findings";

export interface TopicIntervalPoint {
  timestampNs: number;
  deltaNs: number;
}

export const INTERVAL_SERIES_MAX_POINTS = 2000;

export function downsampleIntervalSeries(
  points: readonly TopicIntervalPoint[],
  maxPoints: number
): TopicIntervalPoint[] {
  if (points.length <= maxPoints) {
    return [...points];
  }

  if (points.length === 0) {
    return [];
  }

  const start = points[0].timestampNs;
  const end = points[points.length - 1].timestampNs;
  const span = Math.max(end - start, 1);
  const buckets = new Map<number, TopicIntervalPoint>();

  for (const point of points) {
    const bucketIndex = Math.min(
      maxPoints - 1,
      Math.floor(((point.timestampNs - start) / span) * maxPoints)
    );
    const existing = buckets.get(bucketIndex);
    if (!existing || point.deltaNs > existing.deltaNs) {
      buckets.set(bucketIndex, point);
    }
  }

  return [...buckets.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, point]) => point);
}

class IntervalSeriesCollector {
  private readonly points: TopicIntervalPoint[] = [];
  private previousTimestampNs: number | null = null;

  beginSegment(): void {
    this.previousTimestampNs = null;
  }

  consumeBatch(batch: TopicMessageBatch): void {
    for (const timestampNs of batch.timestampsNs) {
      if (this.previousTimestampNs !== null) {
        this.points.push({
          timestampNs,
          deltaNs: timestampNs - this.previousTimestampNs
        });
      }

      this.previousTimestampNs = timestampNs;
    }
  }

  finalize(): TopicIntervalPoint[] {
    return downsampleIntervalSeries(this.points, INTERVAL_SERIES_MAX_POINTS);
  }
}

export class IntervalSeriesRegistry {
  private readonly collectors = new Map<string, IntervalSeriesCollector>();

  beginSegment(): void {
    for (const collector of this.collectors.values()) {
      collector.beginSegment();
    }
  }

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new IntervalSeriesCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);
  }

  finalize(): Map<string, TopicIntervalPoint[]> {
    const result = new Map<string, TopicIntervalPoint[]>();

    for (const [topicName, collector] of this.collectors) {
      result.set(topicName, collector.finalize());
    }

    return result;
  }
}

export { LARGE_GAP_WARNING_NS as INTERVAL_GAP_WARNING_NS };
