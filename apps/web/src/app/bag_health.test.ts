import { describe, expect, it } from "vitest";
import type { ResultBundle } from "../model/result";
import { computeBagHealth } from "./bag_health";

function createBundle(overrides: Partial<ResultBundle> = {}): ResultBundle {
  return {
    appVersion: "0.0.0",
    createdAt: "2026-01-01T00:00:00.000Z",
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
      topics: [],
      messageCount: 4,
      timeRange: { startNs: 0, endNs: 1 },
      storageStatus: "ready",
      findings: []
    },
    metrics: [],
    findings: [],
    ...overrides
  };
}

describe("computeBagHealth", () => {
  it("returns healthy when scan is ready and findings are empty", () => {
    expect(computeBagHealth(createBundle())).toEqual({
      level: "healthy",
      label: "Healthy",
      detail: "No findings from inventory, catalog, or stream analysis.",
      score: 100
    });
  });

  it("returns degraded when only warnings are present", () => {
    const bundle = createBundle({
      findings: [
        {
          id: "stream-large-gap-1",
          severity: "warning",
          title: "Large timestamp gap",
          detail: "Topic /scan has a maximum inter-message gap of 6 s."
        }
      ]
    });

    expect(computeBagHealth(bundle)).toEqual({
      level: "degraded",
      label: "Degraded",
      detail: "1 warning detected during scan.",
      score: 88
    });
  });

  it("returns critical when errors are present", () => {
    const bundle = createBundle({
      findings: [
        {
          id: "stream-count-mismatch-1",
          severity: "error",
          title: "Stream count mismatch",
          detail: "Topic /fix streamed 2 messages, but catalog reported 5."
        },
        {
          id: "stream-large-gap-1",
          severity: "warning",
          title: "Large timestamp gap",
          detail: "Topic /scan has a maximum inter-message gap of 6 s."
        }
      ]
    });

    expect(computeBagHealth(bundle)).toEqual({
      level: "critical",
      label: "Critical",
      detail: "1 error needs attention before trusting this bag.",
      score: 53
    });
  });

  it("explains diagnostic-only critical findings separately from stream status", () => {
    const bundle = createBundle({
      findings: [
        {
          id: "diagnostic-errors-0",
          severity: "error",
          title: "Diagnostic errors reported",
          detail: "Topic /diagnostics decoded 1 ERROR-level diagnostic status (e.g. cpu)."
        }
      ]
    });

    expect(computeBagHealth(bundle)).toEqual({
      level: "critical",
      label: "Critical",
      detail:
        "1 error needs attention before trusting this bag. Includes 1 Diagnostics. Topic CDR decode can still be ok.",
      score: 65
    });
  });

  it("breaks down mixed diagnostic and stream critical findings", () => {
    const bundle = createBundle({
      findings: [
        {
          id: "diagnostic-errors-0",
          severity: "error",
          title: "Diagnostic errors reported",
          detail: "Topic /diagnostics decoded 1 ERROR-level diagnostic status (e.g. cpu)."
        },
        {
          id: "stream-count-mismatch-1",
          severity: "error",
          title: "Stream count mismatch",
          detail: "Topic /fix streamed 2 messages, but catalog reported 5."
        }
      ]
    });

    expect(computeBagHealth(bundle).detail).toBe(
      "2 errors need attention before trusting this bag. Includes 1 Diagnostics and 1 Stream."
    );
  });

  it("returns pending for incomplete catalogs", () => {
    const bundle = createBundle({
      catalog: {
        ...createBundle().catalog,
        storageStatus: "sqlite_pending"
      }
    });

    expect(computeBagHealth(bundle)).toEqual({
      level: "pending",
      label: "Pending",
      detail: "Catalog scan is incomplete.",
      score: null
    });
  });
});
