import type { ResultBundle, TopicCatalogEntry, TopicPlotKind, TopicPlotTab } from "../src/model/result";
import { RESULT_BUNDLE_EXPORT_SCHEMA_VERSION } from "../src/report/export";

const TOPIC_PLOT_KINDS = new Set<TopicPlotKind>(["intervals", "value", "angular", "range", "xy", "latlon"]);

const STRIPPED_TOPIC_SERIES_KEYS = [
  "intervalSeries",
  "trajectorySeries",
  "geopointSeries",
  "valueSeries",
  "angularVelocitySeries",
  "scanProfileSeries"
] as const;

export function assertExportBundleShape(bundle: ResultBundle): void {
  if (bundle.exportSchemaVersion !== RESULT_BUNDLE_EXPORT_SCHEMA_VERSION) {
    throw new Error(`Expected exportSchemaVersion ${RESULT_BUNDLE_EXPORT_SCHEMA_VERSION}.`);
  }

  if (!bundle.appVersion || !bundle.createdAt || !bundle.catalog || !Array.isArray(bundle.metrics) || !Array.isArray(bundle.findings)) {
    throw new Error("Missing required ResultBundle export fields.");
  }

  if (!Array.isArray(bundle.catalog.topics)) {
    throw new Error("Expected catalog.topics to be an array.");
  }

  for (const topic of bundle.catalog.topics) {
    assertExportTopicShape(topic);
  }
}

function assertExportTopicShape(topic: TopicCatalogEntry): void {
  for (const key of STRIPPED_TOPIC_SERIES_KEYS) {
    if (key in topic) {
      throw new Error(`Topic ${topic.name} must not include ${key} in export JSON.`);
    }
  }

  if (!topic.plotTabs || topic.plotTabs.length === 0) {
    throw new Error(`Topic ${topic.name} must include plotTabs in export JSON.`);
  }

  const plotTabs = topic.plotTabs;
  if (!plotTabs.some((tab) => tab.kind === "intervals")) {
    throw new Error(`Topic ${topic.name} must expose an intervals plot tab.`);
  }

  for (const tab of plotTabs) {
    assertPlotTabShape(tab);
  }
}

function assertPlotTabShape(tab: TopicPlotTab): void {
  if (!TOPIC_PLOT_KINDS.has(tab.kind)) {
    throw new Error(`Unknown plot tab kind: ${tab.kind}`);
  }

  if (!tab.label || !tab.description || typeof tab.pointCount !== "number") {
    throw new Error(`Invalid plot tab metadata for kind ${tab.kind}.`);
  }
}
