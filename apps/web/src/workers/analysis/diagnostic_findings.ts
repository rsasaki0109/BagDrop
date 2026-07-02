import type { TopicMessageBatch } from "../../model/message_batch";
import type { Finding } from "../../model/result";
import { base64ToUint8Array } from "../../platform/base64";
import {
  type DiagnosticArraySummary,
  summarizeDiagnosticMsgsDiagnosticArray
} from "../moonbit/cdr";

function mergeSummary(
  left: DiagnosticArraySummary,
  right: DiagnosticArraySummary
): DiagnosticArraySummary {
  return {
    ok: left.ok + right.ok,
    warnings: left.warnings + right.warnings,
    errors: left.errors + right.errors,
    stale: left.stale + right.stale,
    sampleErrorName: left.sampleErrorName ?? right.sampleErrorName
  };
}

function emptySummary(): DiagnosticArraySummary {
  return {
    ok: 0,
    warnings: 0,
    errors: 0,
    stale: 0,
    sampleErrorName: null
  };
}

export class DiagnosticFindingsRegistry {
  private readonly summaries = new Map<string, DiagnosticArraySummary>();

  consumeBatch(batch: TopicMessageBatch): void {
    if (batch.topicType !== "diagnostic_msgs/msg/DiagnosticArray") {
      return;
    }

    for (const encodedPayload of batch.payloadsBase64) {
      if (encodedPayload.length === 0) {
        continue;
      }

      try {
        const payload = base64ToUint8Array(encodedPayload);
        const summary = summarizeDiagnosticMsgsDiagnosticArray(payload);
        if (!summary) {
          continue;
        }

        const existing = this.summaries.get(batch.topicName) ?? emptySummary();
        this.summaries.set(batch.topicName, mergeSummary(existing, summary));
      } catch {
        // Ignore malformed diagnostic payloads during summary extraction.
      }
    }
  }

  finalize(catalogIdByTopic: ReadonlyMap<string, number>): Finding[] {
    const findings: Finding[] = [];

    for (const [topicName, summary] of this.summaries) {
      const catalogId = catalogIdByTopic.get(topicName) ?? 0;

      if (summary.errors > 0) {
        findings.push({
          id: `diagnostic-errors-${catalogId}`,
          severity: "error",
          title: "Diagnostic errors reported",
          detail: `Topic ${topicName} decoded ${summary.errors} ERROR-level diagnostic status${summary.errors === 1 ? "" : "es"}${
            summary.sampleErrorName ? ` (e.g. ${summary.sampleErrorName})` : ""
          }.`,
          topic: topicName,
          timeBasis: "record_time",
          evidence: {
            errors: summary.errors,
            warnings: summary.warnings,
            stale: summary.stale,
            ok: summary.ok
          }
        });
        continue;
      }

      if (summary.warnings > 0 || summary.stale > 0) {
        findings.push({
          id: `diagnostic-warnings-${catalogId}`,
          severity: "warning",
          title: "Diagnostic warnings reported",
          detail: `Topic ${topicName} decoded ${summary.warnings} warning-level diagnostic status${summary.warnings === 1 ? "" : "es"}.`,
          topic: topicName,
          timeBasis: "record_time",
          evidence: {
            warnings: summary.warnings,
            stale: summary.stale,
            ok: summary.ok
          }
        });
      }
    }

    return findings;
  }
}
