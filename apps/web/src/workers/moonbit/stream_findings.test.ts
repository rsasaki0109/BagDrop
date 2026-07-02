import { describe, expect, it } from "vitest";
import { buildStreamFindings, LARGE_GAP_WARNING_NS } from "./stream_findings";

describe("buildStreamFindings", () => {
  it("prefers count mismatch over large gap warnings", () => {
    const findings = buildStreamFindings([
      {
        catalogId: 1,
        name: "/scan",
        messageCount: 1,
        catalogCount: 2,
        maxGapNs: LARGE_GAP_WARNING_NS,
        decodedPayloads: 0,
        decodeErrors: 0
      }
    ]);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.id).toBe("stream-count-mismatch-1");
  });

  it("emits large gap warnings when counts match", () => {
    const findings = buildStreamFindings([
      {
        catalogId: 3,
        name: "/imu",
        messageCount: 2,
        catalogCount: 2,
        maxGapNs: LARGE_GAP_WARNING_NS,
        decodedPayloads: 0,
        decodeErrors: 0
      }
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        id: "stream-large-gap-3",
        severity: "warning",
        topic: "/imu"
      })
    ]);
  });

  it("emits cdr decode failure findings", () => {
    const findings = buildStreamFindings([
      {
        catalogId: 4,
        name: "/temperature",
        messageCount: 1,
        catalogCount: 1,
        maxGapNs: null,
        decodedPayloads: 0,
        decodeErrors: 2
      }
    ]);

    expect(findings).toEqual([
      expect.objectContaining({
        id: "cdr-decode-failed-4",
        severity: "warning",
        topic: "/temperature"
      })
    ]);
  });
});
