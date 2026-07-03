import { describe, expect, it } from "vitest";
import type { ResultBundle } from "../model/result";
import { toExportableResultBundle } from "./export";

describe("toExportableResultBundle", () => {
  it("keeps plotTabs while stripping heavy plot series", () => {
    const bundle: ResultBundle = {
      appVersion: "0.0.0",
      createdAt: "2026-07-02T10:00:00.000Z",
      catalog: {
        inventory: {
          files: [],
          totalSizeBytes: 0,
          metadataFiles: [],
          sqliteFiles: [],
          mcapFiles: [],
          messageDefinitionFiles: [],
          walFiles: [],
          journalFiles: [],
          warnings: []
        },
        schemaCapabilities: [],
        topics: [
          {
            id: 0,
            name: "/imu",
            type: "sensor_msgs/msg/Imu",
            serializationFormat: "cdr",
            count: 1,
            timeRange: { startNs: 1_000_000_000, endNs: 1_000_000_000 },
            meanRateHz: null,
            maxGapNs: null,
            status: "ok",
            intervalSeries: [{ timestampNs: 1_000_000_000, deltaNs: 0 }],
            valueSeries: [{ timestampNs: 1_000_000_000, value: 5 }],
            angularVelocitySeries: [{ timestampNs: 1_000_000_000, value: 0.5 }],
            plotTabs: [
              {
                kind: "intervals",
                label: "Intervals",
                description: "intervals",
                pointCount: 1
              },
              {
                kind: "value",
                label: "Value",
                description: "value",
                pointCount: 1
              },
              {
                kind: "angular",
                label: "Angular",
                description: "angular",
                pointCount: 1
              }
            ]
          }
        ],
        messageCount: 1,
        timeRange: { startNs: 1_000_000_000, endNs: 1_000_000_000 },
        storageStatus: "ready",
        findings: []
      },
      metrics: [],
      findings: []
    };

    expect(toExportableResultBundle(bundle)).toEqual({
      ...bundle,
      exportSchemaVersion: 1,
      catalog: {
        ...bundle.catalog,
        topics: [
          {
            id: 0,
            name: "/imu",
            type: "sensor_msgs/msg/Imu",
            serializationFormat: "cdr",
            count: 1,
            timeRange: { startNs: 1_000_000_000, endNs: 1_000_000_000 },
            meanRateHz: null,
            maxGapNs: null,
            status: "ok",
            plotTabs: bundle.catalog.topics[0]?.plotTabs
          }
        ]
      }
    });
  });
});
