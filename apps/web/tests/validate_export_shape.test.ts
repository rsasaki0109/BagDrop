import { describe, expect, it } from "vitest";
import type { ResultBundle } from "../src/model/result";
import { assertExportBundleShape } from "./validate_export_shape";

describe("assertExportBundleShape", () => {
  it("accepts a minimal export bundle", () => {
    const bundle: ResultBundle = {
      appVersion: "0.0.0",
      exportSchemaVersion: 1,
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
            name: "/temperature",
            type: "std_msgs/msg/Float64",
            serializationFormat: "cdr",
            count: 1,
            timeRange: { startNs: 1_000_000_000, endNs: 1_000_000_000 },
            meanRateHz: null,
            maxGapNs: null,
            status: "ok",
            plotTabs: [
              {
                kind: "intervals",
                label: "Intervals",
                description: "intervals",
                pointCount: 0
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

    expect(() => assertExportBundleShape(bundle)).not.toThrow();
  });

  it("rejects bundles that still include plot series arrays", () => {
    const bundle: ResultBundle = {
      appVersion: "0.0.0",
      exportSchemaVersion: 1,
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
            name: "/temperature",
            type: "std_msgs/msg/Float64",
            serializationFormat: "cdr",
            count: 1,
            timeRange: { startNs: 1_000_000_000, endNs: 1_000_000_000 },
            meanRateHz: null,
            maxGapNs: null,
            status: "ok",
            valueSeries: [{ timestampNs: 1_000_000_000, value: 42 }],
            plotTabs: [
              {
                kind: "intervals",
                label: "Intervals",
                description: "intervals",
                pointCount: 0
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

    expect(() => assertExportBundleShape(bundle)).toThrow(/valueSeries/);
  });
});
