import { describe, expect, it } from "vitest";
import type { TopicCatalogEntry } from "../model/result";
import { filterTopics } from "./topic_filter";

const topics: TopicCatalogEntry[] = [
  {
    id: 0,
    name: "/odom",
    type: "nav_msgs/msg/Odometry",
    serializationFormat: "cdr",
    count: 3,
    timeRange: { startNs: 0, endNs: 1 },
    meanRateHz: 1,
    maxGapNs: 1,
    status: "ok"
  },
  {
    id: 1,
    name: "/diagnostics",
    type: "diagnostic_msgs/msg/DiagnosticArray",
    serializationFormat: "cdr",
    count: 1,
    timeRange: { startNs: 0, endNs: 1 },
    meanRateHz: 1,
    maxGapNs: null,
    status: "ok"
  }
];

describe("filterTopics", () => {
  it("returns all topics for an empty query", () => {
    expect(filterTopics(topics, "")).toEqual(topics);
  });

  it("filters by topic name or type", () => {
    expect(filterTopics(topics, "diag").map((topic) => topic.name)).toEqual(["/diagnostics"]);
    expect(filterTopics(topics, "Odometry").map((topic) => topic.name)).toEqual(["/odom"]);
  });
});
