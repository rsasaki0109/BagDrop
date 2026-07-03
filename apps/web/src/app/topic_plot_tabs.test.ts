import { describe, expect, it } from "vitest";
import type { TopicCatalogEntry } from "../model/result";
import { buildTopicPlotTabs, topicSupportsPlotKind } from "./topic_plot_tabs";

function createTopic(overrides: Partial<TopicCatalogEntry> = {}): TopicCatalogEntry {
  return {
    id: 0,
    name: "/example",
    type: "std_msgs/msg/Float64",
    serializationFormat: "cdr",
    count: 1,
    timeRange: { startNs: 1_000_000_000, endNs: 2_000_000_000 },
    meanRateHz: 1,
    maxGapNs: 1_000_000_000,
    status: "ok",
    intervalSeries: [{ timestampNs: 2_000_000_000, deltaNs: 1_000_000_000 }],
    ...overrides
  };
}

describe("buildTopicPlotTabs", () => {
  it("lists scalar value tabs for temperature topics", () => {
    const topic = createTopic({
      name: "/temperature",
      valueSeries: [{ timestampNs: 1_000_000_000, value: 42 }]
    });

    expect(buildTopicPlotTabs(topic)).toEqual([
      {
        kind: "intervals",
        label: "Intervals",
        description:
          "Message interval Δt (seconds) vs bag time. Orange line marks the 5 s large-gap warning threshold.",
        pointCount: 1
      },
      {
        kind: "value",
        label: "Value",
        description: "Decoded std_msgs/msg/Float64 values over bag time.",
        pointCount: 1
      }
    ]);
  });

  it("lists value and angular tabs for Imu topics", () => {
    const topic = createTopic({
      name: "/imu",
      type: "sensor_msgs/msg/Imu",
      valueSeries: [{ timestampNs: 1_000_000_000, value: 5 }],
      angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: 0.5 }]
    });

    expect(buildTopicPlotTabs(topic).map((tab) => tab.kind)).toEqual(["intervals", "value", "angular"]);
    expect(buildTopicPlotTabs(topic)[2]?.description).toBe("|Angular velocity| (rad/s) over bag time.");
  });

  it("lists value and angular tabs for TwistStamped topics", () => {
    const topic = createTopic({
      name: "/cmd_vel",
      type: "geometry_msgs/msg/TwistStamped",
      valueSeries: [{ timestampNs: 1_000_000_000, value: 0.5 }],
      angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: -0.2 }]
    });

    expect(buildTopicPlotTabs(topic).map((tab) => tab.kind)).toEqual(["intervals", "value", "angular"]);
    expect(buildTopicPlotTabs(topic)[2]?.description).toBe("Angular z (rad/s) over bag time.");
  });

  it("lists value and angular tabs for TwistWithCovarianceStamped topics", () => {
    const topic = createTopic({
      name: "/velocity",
      type: "geometry_msgs/msg/TwistWithCovarianceStamped",
      valueSeries: [{ timestampNs: 1_000_000_000, value: 1.5 }],
      angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: 0.75 }]
    });

    expect(buildTopicPlotTabs(topic).map((tab) => tab.kind)).toEqual(["intervals", "value", "angular"]);
  });

  it("lists range and value tabs for LaserScan topics", () => {
    const topic = createTopic({
      name: "/scan",
      type: "sensor_msgs/msg/LaserScan",
      valueSeries: [{ timestampNs: 1_000_000_000, value: 1.0 }],
      scanProfileSeries: {
        timestampNs: 1_000_000_000,
        angleMin: -1,
        angleIncrement: 0.1,
        ranges: [1, 2]
      }
    });

    expect(buildTopicPlotTabs(topic).map((tab) => tab.kind)).toEqual(["intervals", "value", "range"]);
  });
});

describe("topicSupportsPlotKind", () => {
  it("reads precomputed plotTabs when present", () => {
    const topic = createTopic({
      plotTabs: [{ kind: "intervals", label: "Intervals", description: "x", pointCount: 1 }]
    });

    expect(topicSupportsPlotKind(topic, "intervals")).toBe(true);
    expect(topicSupportsPlotKind(topic, "value")).toBe(false);
  });
});
