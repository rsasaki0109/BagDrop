import type { BagCatalog, Finding, Metric, TopicCatalogEntry } from "../../model/result";
import type { WorkerFileRef } from "../../model/worker_messages";
import { createMoonBitCoreSession } from "../moonbit/load_core";
import type { MoonBitTopicResult } from "../moonbit/types";
import { SqliteSegmentDeferredError, withReadonlySegmentDatabase } from "../sqlite/db_session";
import { scanSegmentTopicStreams } from "../sqlite/stream_scan";

export interface StreamAnalysisResult {
  topics: TopicCatalogEntry[];
  findings: Finding[];
  metrics: Metric[];
}

export async function runStreamAnalysis(
  catalog: BagCatalog,
  fileRefs: readonly WorkerFileRef[],
  sessionFactory: () => Promise<Awaited<ReturnType<typeof createMoonBitCoreSession>>> = createMoonBitCoreSession
): Promise<StreamAnalysisResult> {
  const fileById = new Map(fileRefs.map((fileRef) => [fileRef.id, fileRef.file]));
  const findings: Finding[] = [];
  const session = await sessionFactory();
  session.registerTopics(catalog.topics);

  let segmentsScanned = 0;

  for (const sqliteFile of catalog.inventory.sqliteFiles) {
    const file = fileById.get(sqliteFile.id);
    if (!file) {
      continue;
    }

    try {
      await withReadonlySegmentDatabase(file, sqliteFile, (db) => {
        scanSegmentTopicStreams(db, catalog.topics, {
          onBatch: (batch) => session.consumeBatch(batch)
        });
      });
      segmentsScanned += 1;
    } catch (error) {
      if (error instanceof SqliteSegmentDeferredError) {
        continue;
      }

      findings.push({
        id: `stream-scan-failed-${sqliteFile.id}`,
        severity: "error",
        title: "Stream scan failed",
        detail: error instanceof Error ? error.message : String(error),
        evidence: { path: sqliteFile.path }
      });
    }
  }

  const moonbitResult = session.finish();
  const moonbitByTopicName = new Map(moonbitResult.topics.map((topic) => [topic.name, topic]));
  const topics = catalog.topics.map((topic) => {
    const moonbitTopic = moonbitByTopicName.get(topic.name);
    if (!moonbitTopic) {
      return topic;
    }

    return applyMoonBitStats(topic, moonbitTopic);
  });

  return {
    topics,
    findings: [...findings, ...moonbitResult.findings],
    metrics: [
      {
        id: "stream-segments-scanned",
        label: "Stream segments scanned",
        value: segmentsScanned
      },
      {
        id: "stream-batches-read",
        label: "Stream batches read",
        value: moonbitResult.batchesConsumed
      },
      {
        id: "stream-verified-topics",
        label: "Stream verified topics",
        value: topics.filter((topic) => topic.status !== "unknown").length
      },
      {
        id: "moonbit-backend",
        label: "MoonBit backend",
        value: session.backendKind
      },
      {
        id: "moonbit-batches-consumed",
        label: "MoonBit batches consumed",
        value: moonbitResult.batchesConsumed
      }
    ]
  };
}

function applyMoonBitStats(
  topic: TopicCatalogEntry,
  moonbitTopic: MoonBitTopicResult
): TopicCatalogEntry {
  return {
    ...topic,
    maxGapNs: moonbitTopic.maxGapNs,
    meanRateHz: moonbitTopic.meanRateHz ?? topic.meanRateHz,
    status: moonbitTopic.status
  };
}
