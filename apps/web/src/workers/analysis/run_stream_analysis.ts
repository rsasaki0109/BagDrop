import type { BagCatalog, Finding, Metric, TopicCatalogEntry } from "../../model/result";
import type { WorkerFileRef } from "../../model/worker_messages";
import { createMoonBitCoreSession } from "../moonbit/load_core";
import type { MoonBitTopicResult } from "../moonbit/types";
import { SqliteSegmentDeferredError, withReadonlySegmentDatabase } from "../sqlite/db_session";
import { scanSegmentTopicStreams } from "../sqlite/stream_scan";
import type { TopicMessageBatch } from "../../model/message_batch";
import { DiagnosticFindingsRegistry } from "./diagnostic_findings";
import { GeopointSeriesRegistry } from "./geopoint_series";
import { IntervalSeriesRegistry } from "./interval_series";
import { ScanProfileSeriesRegistry } from "./scan_profile_series";
import { TrajectorySeriesRegistry } from "./trajectory_series";
import { ValueSeriesRegistry } from "./value_series";

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
  const intervalRegistry = new IntervalSeriesRegistry();
  const trajectoryRegistry = new TrajectorySeriesRegistry();
  const geopointRegistry = new GeopointSeriesRegistry();
  const valueRegistry = new ValueSeriesRegistry();
  const scanProfileRegistry = new ScanProfileSeriesRegistry();
  const diagnosticRegistry = new DiagnosticFindingsRegistry();
  const catalogIdByTopic = new Map(catalog.topics.map((topic) => [topic.name, topic.id]));

  let segmentsScanned = 0;

  for (const sqliteFile of catalog.inventory.sqliteFiles) {
    const file = fileById.get(sqliteFile.id);
    if (!file) {
      continue;
    }

    try {
      intervalRegistry.beginSegment();
      await withReadonlySegmentDatabase(file, sqliteFile, (db) => {
        scanSegmentTopicStreams(db, catalog.topics, {
          onBatch: (batch) => {
            session.consumeBatch(batch);
            intervalRegistry.consumeBatch(batch);
            trajectoryRegistry.consumeBatch(batch);
            geopointRegistry.consumeBatch(batch);
            valueRegistry.consumeBatch(batch);
            scanProfileRegistry.consumeBatch(batch);
            diagnosticRegistry.consumeBatch(batch);
          }
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
  const intervalSeriesByTopic = intervalRegistry.finalize();
  const trajectorySeriesByTopic = trajectoryRegistry.finalize();
  const geopointSeriesByTopic = geopointRegistry.finalize();
  const valueSeriesByTopic = valueRegistry.finalize();
  const scanProfileSeriesByTopic = scanProfileRegistry.finalize();
  const moonbitByTopicName = new Map(moonbitResult.topics.map((topic) => [topic.name, topic]));
  const topics = catalog.topics.map((topic) => {
    const moonbitTopic = moonbitByTopicName.get(topic.name);
    const intervalSeries = intervalSeriesByTopic.get(topic.name) ?? null;
    const trajectorySeries = trajectorySeriesByTopic.get(topic.name) ?? null;
    const geopointSeries = geopointSeriesByTopic.get(topic.name) ?? null;
    const valueSeries = valueSeriesByTopic.get(topic.name) ?? null;
    const scanProfileSeries = scanProfileSeriesByTopic.get(topic.name) ?? null;

    if (!moonbitTopic) {
      return {
        ...topic,
        intervalSeries,
        trajectorySeries,
        geopointSeries,
        valueSeries,
        scanProfileSeries
      };
    }

    return applyMoonBitStats(
      topic,
      moonbitTopic,
      intervalSeries,
      trajectorySeries,
      geopointSeries,
      valueSeries,
      scanProfileSeries
    );
  });

  return {
    topics,
    findings: [...findings, ...moonbitResult.findings, ...diagnosticRegistry.finalize(catalogIdByTopic)],
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
  moonbitTopic: MoonBitTopicResult,
  intervalSeries: TopicCatalogEntry["intervalSeries"],
  trajectorySeries: TopicCatalogEntry["trajectorySeries"],
  geopointSeries: TopicCatalogEntry["geopointSeries"],
  valueSeries: TopicCatalogEntry["valueSeries"],
  scanProfileSeries: TopicCatalogEntry["scanProfileSeries"]
): TopicCatalogEntry {
  return {
    ...topic,
    maxGapNs: moonbitTopic.maxGapNs,
    meanRateHz: moonbitTopic.meanRateHz ?? topic.meanRateHz,
    status: moonbitTopic.status,
    decodedPayloads: moonbitTopic.decodedPayloads,
    decodeErrors: moonbitTopic.decodeErrors,
    intervalSeries,
    trajectorySeries,
    geopointSeries,
    valueSeries,
    scanProfileSeries
  };
}
