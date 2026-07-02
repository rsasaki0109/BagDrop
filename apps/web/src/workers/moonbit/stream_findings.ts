import type { Finding } from "../../model/result";

export const LARGE_GAP_WARNING_NS = 5_000_000_000;

export interface StreamTopicSnapshot {
  catalogId: number;
  name: string;
  messageCount: number;
  catalogCount: number | null;
  maxGapNs: number | null;
  decodedPayloads: number;
  decodeErrors: number;
}

export function topicStatusFromSnapshot(
  snapshot: StreamTopicSnapshot
): "ok" | "warning" | "error" {
  if (snapshot.catalogCount !== null && snapshot.messageCount !== snapshot.catalogCount) {
    return "error";
  }

  if (snapshot.maxGapNs !== null && snapshot.maxGapNs >= LARGE_GAP_WARNING_NS) {
    return "warning";
  }

  return "ok";
}

export function buildStreamFindings(snapshots: readonly StreamTopicSnapshot[]): Finding[] {
  const findings: Finding[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.catalogCount !== null && snapshot.messageCount !== snapshot.catalogCount) {
      findings.push({
        id: `stream-count-mismatch-${snapshot.catalogId}`,
        severity: "error",
        title: "Stream count mismatch",
        detail:
          `Topic ${snapshot.name} streamed ${snapshot.messageCount} messages, but the catalog aggregate reported ${snapshot.catalogCount}.`,
        topic: snapshot.name,
        timeBasis: "record_time",
        evidence: {
          streamedCount: snapshot.messageCount,
          catalogCount: snapshot.catalogCount
        }
      });
      continue;
    }

    if (snapshot.maxGapNs !== null && snapshot.maxGapNs >= LARGE_GAP_WARNING_NS) {
      findings.push({
        id: `stream-large-gap-${snapshot.catalogId}`,
        severity: "warning",
        title: "Large timestamp gap",
        detail: `Topic ${snapshot.name} has a maximum inter-message gap of ${formatSeconds(snapshot.maxGapNs)}.`,
        topic: snapshot.name,
        timeBasis: "record_time",
        evidence: {
          maxGapNs: snapshot.maxGapNs
        }
      });
    }

    if (snapshot.decodeErrors > 0) {
      findings.push({
        id: `cdr-decode-failed-${snapshot.catalogId}`,
        severity: "warning",
        title: "CDR decode failures",
        detail: `Topic ${snapshot.name} had ${snapshot.decodeErrors} CDR payload(s) that could not be decoded.`,
        topic: snapshot.name,
        timeBasis: "record_time",
        evidence: {
          decodedPayloads: snapshot.decodedPayloads,
          decodeErrors: snapshot.decodeErrors
        }
      });
    }
  }

  return findings;
}

function formatSeconds(nanoseconds: number): string {
  return `${(nanoseconds / 1_000_000_000).toFixed(3)} s`;
}
