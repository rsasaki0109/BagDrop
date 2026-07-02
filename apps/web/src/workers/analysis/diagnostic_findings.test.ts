import { describe, expect, it } from "vitest";
import type { TopicMessageBatch } from "../../model/message_batch";
import { uint8ArrayToBase64 } from "../../platform/base64";
import { buildMinimalDiagnosticMsgsDiagnosticArrayPayload } from "../moonbit/cdr";
import { DiagnosticFindingsRegistry } from "./diagnostic_findings";

describe("DiagnosticFindingsRegistry", () => {
  it("emits error findings for diagnostic arrays with ERROR statuses", () => {
    const registry = new DiagnosticFindingsRegistry();
    const payload = buildMinimalDiagnosticMsgsDiagnosticArrayPayload([
      { level: 2, name: "cpu", message: "hot" }
    ]);
    const batch: TopicMessageBatch = {
      topicName: "/diagnostics",
      topicType: "diagnostic_msgs/msg/DiagnosticArray",
      serializationFormat: "cdr",
      timestampsNs: [1_000_000_000],
      payloadSizesBytes: [payload.length],
      payloadsBase64: [uint8ArrayToBase64(payload)]
    };

    registry.consumeBatch(batch);

    const findings = registry.finalize(new Map([["/diagnostics", 1]]));
    expect(findings).toEqual([
      expect.objectContaining({
        id: "diagnostic-errors-1",
        severity: "error",
        topic: "/diagnostics",
        title: "Diagnostic errors reported"
      })
    ]);
  });
});
