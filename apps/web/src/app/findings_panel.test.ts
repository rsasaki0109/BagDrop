import { describe, expect, it } from "vitest";
import type { Finding } from "../model/result";
import {
  findingCategory,
  renderFindingsPanel,
  renderFindingsSummary,
  sortFindings,
  summarizeFindings
} from "./findings_panel";

const sampleFindings: Finding[] = [
  {
    id: "stream-large-gap-1",
    severity: "warning",
    title: "Large timestamp gap",
    detail: "Topic /odom has a maximum inter-message gap of 6.000 s.",
    topic: "/odom",
    evidence: { maxGapNs: 6_000_000_000 }
  },
  {
    id: "inventory-0-wal_present",
    severity: "error",
    title: "wal present",
    detail: "WAL file detected.",
    evidence: { path: "segment_0.db3-wal" }
  },
  {
    id: "direct-file-vfs-unavailable",
    severity: "warning",
    title: "DirectFileVFS unavailable",
    detail: "Fallback path will be used."
  }
];

describe("findings_panel", () => {
  it("summarizes findings by severity", () => {
    expect(summarizeFindings(sampleFindings)).toEqual({
      total: 3,
      errors: 1,
      warnings: 2,
      info: 0
    });
  });

  it("sorts findings with errors first", () => {
    expect(sortFindings(sampleFindings).map((finding) => finding.id)).toEqual([
      "inventory-0-wal_present",
      "direct-file-vfs-unavailable",
      "stream-large-gap-1"
    ]);
  });

  it("infers finding categories from ids", () => {
    expect(findingCategory(sampleFindings[0]!)).toBe("Stream");
    expect(findingCategory(sampleFindings[1]!)).toBe("Inventory");
    expect(findingCategory(sampleFindings[2]!)).toBe("Storage");
  });

  it("renders summary text", () => {
    expect(renderFindingsSummary(summarizeFindings(sampleFindings))).toBe("1 error, 2 warnings");
  });

  it("renders topic and evidence in the panel", () => {
    const html = renderFindingsPanel({
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
        messageCount: null,
        timeRange: { startNs: null, endNs: null },
        storageStatus: "ready",
        findings: sampleFindings
      },
      metrics: [],
      findings: sampleFindings
    });

    expect(html).toContain("finding-summary-pill");
    expect(html).toContain('class="finding-topic-link"');
    expect(html).toContain('data-topic-name="/odom"');
    expect(html).toContain("Max Gap Ns");
    expect(html).toContain("6,000,000,000");
  });
});
