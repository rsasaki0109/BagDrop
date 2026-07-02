export type Severity = "info" | "warning" | "error";

export type TimeBasis = "record_time" | "source_time";

export type SchemaCapability =
  | "legacy"
  | "has_qos"
  | "has_type_hash"
  | "has_embedded_definitions"
  | "has_embedded_metadata";

export interface TimeRange {
  startNs: number | null;
  endNs: number | null;
}

export interface BagFileSummary {
  id: string;
  path: string;
  name: string;
  sizeBytes: number;
  kind: "metadata" | "sqlite" | "mcap" | "message_definition" | "wal" | "journal" | "other";
  segmentOrdinal: number | null;
}

export interface InventoryWarning {
  severity: Severity;
  code: string;
  message: string;
  path?: string;
}

export interface BagInventory {
  files: BagFileSummary[];
  totalSizeBytes: number;
  metadataFiles: BagFileSummary[];
  sqliteFiles: BagFileSummary[];
  mcapFiles: BagFileSummary[];
  messageDefinitionFiles: BagFileSummary[];
  walFiles: BagFileSummary[];
  journalFiles: BagFileSummary[];
  warnings: InventoryWarning[];
}

export interface TopicIntervalPoint {
  timestampNs: number;
  deltaNs: number;
}

export interface TopicTrajectoryPoint {
  x: number;
  y: number;
}

export interface TopicGeopoint {
  lat: number;
  lon: number;
}

export interface TopicCatalogEntry {
  id: number;
  name: string;
  type: string;
  serializationFormat: string | null;
  count: number | null;
  timeRange: TimeRange;
  meanRateHz: number | null;
  maxGapNs: number | null;
  status: "ok" | "warning" | "error" | "unknown";
  decodedPayloads?: number | null;
  decodeErrors?: number | null;
  intervalSeries?: TopicIntervalPoint[] | null;
  trajectorySeries?: TopicTrajectoryPoint[] | null;
  geopointSeries?: TopicGeopoint[] | null;
}

export interface BagCatalog {
  inventory: BagInventory;
  schemaCapabilities: SchemaCapability[];
  topics: TopicCatalogEntry[];
  messageCount: number | null;
  timeRange: TimeRange;
  storageStatus: "inventory_only" | "sqlite_pending" | "ready" | "blocked";
  findings: Finding[];
}

export interface Metric {
  id: string;
  label: string;
  value: number | string | null;
  unit?: string;
  topic?: string;
  fieldPath?: string;
  timeBasis?: TimeBasis;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  topic?: string;
  timeBasis?: TimeBasis;
  evidence?: Record<string, unknown>;
}

export interface ResultBundle {
  appVersion: string;
  createdAt: string;
  catalog: BagCatalog;
  metrics: Metric[];
  findings: Finding[];
}

export interface WorkerProgress {
  phase: "inventory" | "catalog" | "analysis" | "done";
  message: string;
  ratio: number | null;
}
