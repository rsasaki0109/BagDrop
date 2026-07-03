import type { TopicCatalogEntry, TopicPlotKind, TopicPlotTab } from "../model/result";

function isTwistType(type: string): boolean {
  return type === "geometry_msgs/msg/TwistStamped" || type === "geometry_msgs/msg/TwistWithCovarianceStamped";
}

const PLOT_TAB_LABELS: Record<TopicPlotKind, string> = {
  intervals: "Intervals",
  value: "Value",
  angular: "Angular",
  range: "Range",
  xy: "XY trajectory",
  latlon: "Lat/Lon"
};

export function buildTopicPlotTabs(topic: TopicCatalogEntry): TopicPlotTab[] {
  const intervalCount = topic.intervalSeries?.length ?? 0;
  const trajectoryCount = topic.trajectorySeries?.length ?? 0;
  const geopointCount = topic.geopointSeries?.length ?? 0;
  const valueCount = topic.valueSeries?.length ?? 0;
  const angularVelocityCount = topic.angularVelocitySeries?.length ?? 0;
  const scanProfile = topic.scanProfileSeries;
  const scanPointCount = scanProfile?.ranges.length ?? 0;

  const candidates: Array<{ kind: TopicPlotKind; enabled: boolean; pointCount: number }> = [
    { kind: "intervals", enabled: true, pointCount: intervalCount },
    { kind: "value", enabled: valueCount > 0, pointCount: valueCount },
    { kind: "angular", enabled: angularVelocityCount > 0, pointCount: angularVelocityCount },
    { kind: "range", enabled: scanProfile !== null && scanProfile !== undefined, pointCount: scanPointCount },
    { kind: "xy", enabled: trajectoryCount > 0, pointCount: trajectoryCount },
    { kind: "latlon", enabled: geopointCount > 0, pointCount: geopointCount }
  ];

  return candidates
    .filter((candidate) => candidate.enabled)
    .map((candidate) => ({
      kind: candidate.kind,
      label: PLOT_TAB_LABELS[candidate.kind],
      description: describeTopicPlotTab(topic, candidate.kind),
      pointCount: candidate.pointCount
    }));
}

export function topicSupportsPlotKind(topic: TopicCatalogEntry, kind: TopicPlotKind): boolean {
  const tabs = topic.plotTabs ?? buildTopicPlotTabs(topic);
  return tabs.some((tab) => tab.kind === kind);
}

export function describeTopicPlotTab(topic: TopicCatalogEntry, kind: TopicPlotKind): string {
  switch (kind) {
    case "range":
      return "Latest LaserScan ranges plotted against bearing. Use Value for minimum range over bag time.";
    case "xy":
      return topic.type === "nav_msgs/msg/Path"
        ? "Path poses projected to x/y. Green marks the first pose and orange marks the last."
        : "Pose projected to x/y. Green marks the first pose and orange marks the last.";
    case "latlon":
      return "NavSatFix latitude and longitude track. Green marks the first fix and orange marks the last.";
    case "value":
      if (topic.type === "sensor_msgs/msg/Imu") {
        return "|Linear acceleration| (m/s²) over bag time.";
      }

      if (isTwistType(topic.type)) {
        return "Linear x velocity (m/s) over bag time.";
      }

      if (topic.type === "sensor_msgs/msg/LaserScan") {
        return "Minimum valid range per scan over bag time.";
      }

      return `Decoded ${topic.type} values over bag time.`;
    case "angular":
      if (isTwistType(topic.type)) {
        return "Angular z (rad/s) over bag time.";
      }

      return "|Angular velocity| (rad/s) over bag time.";
    default:
      return "Message interval Δt (seconds) vs bag time. Orange line marks the 5 s large-gap warning threshold.";
  }
}

export function topicPlotPointCount(topic: TopicCatalogEntry, kind: TopicPlotKind): number {
  switch (kind) {
    case "range":
      return topic.scanProfileSeries?.ranges.length ?? 0;
    case "xy":
      return topic.trajectorySeries?.length ?? 0;
    case "latlon":
      return topic.geopointSeries?.length ?? 0;
    case "value":
      return topic.valueSeries?.length ?? 0;
    case "angular":
      return topic.angularVelocitySeries?.length ?? 0;
    default:
      return topic.intervalSeries?.length ?? 0;
  }
}

export function attachTopicPlotTabs(topic: TopicCatalogEntry): TopicCatalogEntry {
  return {
    ...topic,
    plotTabs: buildTopicPlotTabs(topic)
  };
}
