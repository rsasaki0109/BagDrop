import type { TopicMessageBatch } from "../../model/message_batch";
import type { TopicTrajectoryPoint } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import {
  decodeGeometryMsgsPoseStampedXY,
  decodeGeometryMsgsPoseWithCovarianceStampedXY,
  decodeNavMsgsOdometryXY
} from "../moonbit/cdr";

export type { TopicTrajectoryPoint };

export const TRAJECTORY_SERIES_MAX_POINTS = 2000;

const TRAJECTORY_TOPIC_TYPES = new Set([
  "geometry_msgs/msg/PoseStamped",
  "geometry_msgs/msg/PoseWithCovarianceStamped",
  "nav_msgs/msg/Odometry"
]);

function decodeTrajectoryXY(
  topicType: string,
  payload: Uint8Array
): { x: number; y: number } | null {
  if (topicType === "nav_msgs/msg/Odometry") {
    return decodeNavMsgsOdometryXY(payload);
  }

  if (topicType === "geometry_msgs/msg/PoseStamped") {
    return decodeGeometryMsgsPoseStampedXY(payload);
  }

  if (topicType === "geometry_msgs/msg/PoseWithCovarianceStamped") {
    return decodeGeometryMsgsPoseWithCovarianceStampedXY(payload);
  }

  return null;
}

export function downsampleTrajectorySeries(
  points: readonly TopicTrajectoryPoint[],
  maxPoints: number
): TopicTrajectoryPoint[] {
  if (points.length <= maxPoints) {
    return [...points];
  }

  const result: TopicTrajectoryPoint[] = [];
  const stride = points.length / maxPoints;

  for (let index = 0; index < maxPoints; index += 1) {
    result.push(points[Math.floor(index * stride)]);
  }

  return result;
}

class TrajectorySeriesCollector {
  private readonly points: TopicTrajectoryPoint[] = [];

  consumeBatch(batch: TopicMessageBatch): void {
    if (!TRAJECTORY_TOPIC_TYPES.has(batch.topicType)) {
      return;
    }

    for (const encodedPayload of batch.payloadsBase64) {
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const position = decodeTrajectoryXY(batch.topicType, payload);
        if (position) {
          this.points.push(position);
        }
      } catch {
        // Ignore malformed payloads during trajectory extraction.
      }
    }
  }

  finalize(): TopicTrajectoryPoint[] {
    return downsampleTrajectorySeries(this.points, TRAJECTORY_SERIES_MAX_POINTS);
  }
}

export class TrajectorySeriesRegistry {
  private readonly collectors = new Map<string, TrajectorySeriesCollector>();

  consumeBatch(batch: TopicMessageBatch): void {
    let collector = this.collectors.get(batch.topicName);
    if (!collector) {
      collector = new TrajectorySeriesCollector();
      this.collectors.set(batch.topicName, collector);
    }

    collector.consumeBatch(batch);
  }

  finalize(): Map<string, TopicTrajectoryPoint[]> {
    const result = new Map<string, TopicTrajectoryPoint[]>();

    for (const [topicName, collector] of this.collectors) {
      const points = collector.finalize();
      if (points.length > 0) {
        result.set(topicName, points);
      }
    }

    return result;
  }
}
