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
        maxGapNs: LARGE_GAP_WARNING_NS
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
        maxGapNs: LARGE_GAP_WARNING_NS
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
});
