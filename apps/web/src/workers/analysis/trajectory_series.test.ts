import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalGeometryMsgsPoseStampedPayload, buildMinimalNavMsgsOdometryPayload } from "../moonbit/cdr";
import { TrajectorySeriesRegistry, downsampleTrajectorySeries } from "./trajectory_series";

describe("downsampleTrajectorySeries", () => {
  it("uniformly thins long trajectories", () => {
    const points = Array.from({ length: 10 }, (_, index) => ({ x: index, y: index * 2 }));

    expect(downsampleTrajectorySeries(points, 5)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 4 },
      { x: 4, y: 8 },
      { x: 6, y: 12 },
      { x: 8, y: 16 }
    ]);
  });
});

describe("TrajectorySeriesRegistry", () => {
  it("extracts odometry x/y positions from payloads", () => {
    const registry = new TrajectorySeriesRegistry();
    const payload = buildMinimalNavMsgsOdometryPayload({ x: 1.5, y: -2.25 });
    const batch: TopicMessageBatch = {
      topicName: "/odom",
      topicType: "nav_msgs/msg/Odometry",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000, 2_000_000_000],
      payloadSizesBytes: [payload.length, payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload), uint8ArrayToBase64(payload)]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/odom")).toEqual([
      { x: 1.5, y: -2.25 },
      { x: 1.5, y: -2.25 }
    ]);
  });

  it("extracts pose stamped x/y positions from payloads", () => {
    const registry = new TrajectorySeriesRegistry();
    const payload = buildMinimalGeometryMsgsPoseStampedPayload({ x: 0.5, y: 1.25 });
    const batch: TopicMessageBatch = {
      topicName: "/amcl_pose",
      topicType: "geometry_msgs/msg/PoseStamped",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload)]
    };

    registry.consumeBatch(batch);

    expect(registry.finalize().get("/amcl_pose")).toEqual([{ x: 0.5, y: 1.25 }]);
  });
});
