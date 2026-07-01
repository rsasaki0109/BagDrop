import { buildInventory } from "../platform/file_inventory";
import type { BagCatalog, Finding, Metric, ResultBundle, WorkerProgress } from "../model/result";
import type { BagWorkerRequest, BagWorkerResponse } from "../model/worker_messages";
import { runStreamAnalysis } from "./analysis/run_stream_analysis";
import { detectDirectFileVfsSupport } from "./sqlite/direct_file_vfs";
import { bootstrapSqliteRuntime } from "./sqlite/bootstrap";
import { scanSqliteCatalog } from "./sqlite/catalog";

const cancelledRequests = new Set<string>();

self.addEventListener("message", (event: MessageEvent<BagWorkerRequest>) => {
  const request = event.data;

  if (request.type === "cancel") {
    cancelledRequests.add(request.id);
    return;
  }

  void handleScan(request).catch((error: unknown) => {
    postResponse({
      id: request.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  });
});

async function handleScan(request: Extract<BagWorkerRequest, { type: "scan" }>): Promise<void> {
  postProgress(request.id, {
    phase: "inventory",
    message: "Inspecting selected files",
    ratio: 0.1
  });

  const inventory = buildInventory(request.files);
  if (isCancelled(request.id)) {
    return;
  }

  postProgress(request.id, {
    phase: "catalog",
    message: "Scanning SQLite catalog",
    ratio: 0.45
  });

  let catalog = await createCatalog(inventory, request.files);
  if (isCancelled(request.id)) {
    return;
  }

  let analysisMetrics: Metric[] = [];

  if (catalog.storageStatus === "ready" && catalog.topics.length > 0) {
    postProgress(request.id, {
      phase: "analysis",
      message: "Streaming message timestamps",
      ratio: 0.75
    });

    const analysis = await runStreamAnalysis(catalog, request.files);
    if (isCancelled(request.id)) {
      return;
    }

    catalog = {
      ...catalog,
      topics: analysis.topics,
      findings: [...catalog.findings, ...analysis.findings]
    };
    analysisMetrics = analysis.metrics;
  }

  const bundle = createResultBundle(catalog, analysisMetrics);

  postProgress(request.id, {
    phase: "done",
    message: "Scan complete",
    ratio: 1
  });

  postResponse({
    id: request.id,
    type: "catalog",
    catalog,
    bundle
  });
}

async function createCatalog(
  inventory: ReturnType<typeof buildInventory>,
  files: Extract<BagWorkerRequest, { type: "scan" }>["files"]
): Promise<BagCatalog> {
  const hasBlockingStorageIssue = inventory.warnings.some((warning) => warning.severity === "error");
  const directFileVfs = detectDirectFileVfsSupport();
  const sqliteRuntime = await bootstrapSqliteRuntime();
  const findings: Finding[] = inventory.warnings.map((warning, index) => ({
    id: `inventory-${index}-${warning.code}`,
    severity: warning.severity,
    title: warning.code.replaceAll("_", " "),
    detail: warning.message,
    evidence: warning.path ? { path: warning.path } : undefined
  }));

  if (!directFileVfs.supported) {
    findings.push({
      id: "direct-file-vfs-unavailable",
      severity: "warning",
      title: "DirectFileVFS unavailable",
      detail: sqliteRuntime.opfsSqliteSupported
        ? `${directFileVfs.reason} Large SQLite segments will be staged in OPFS when needed.`
        : directFileVfs.reason,
      evidence: {
        fallback: sqliteRuntime.opfsSqliteSupported ? "opfs_staging" : "none"
      }
    });
  }

  if (!hasBlockingStorageIssue && inventory.sqliteFiles.length > 0) {
    const sqliteCatalog = await scanSqliteCatalog(inventory.sqliteFiles, files);
    findings.push(...sqliteCatalog.findings);

    return {
      inventory,
      schemaCapabilities: sqliteCatalog.schemaCapabilities,
      topics: sqliteCatalog.topics,
      messageCount: sqliteCatalog.messageCount,
      timeRange: sqliteCatalog.timeRange,
      storageStatus:
        sqliteCatalog.findings.some((finding) => finding.severity === "error")
          ? "blocked"
          : sqliteCatalog.skippedFiles === 0 && sqliteCatalog.scannedFiles > 0
            ? "ready"
            : "sqlite_pending",
      findings
    };
  }

  return {
    inventory,
    schemaCapabilities: [],
    topics: [],
    messageCount: null,
    timeRange: {
      startNs: null,
      endNs: null
    },
    storageStatus: hasBlockingStorageIssue
      ? "blocked"
      : inventory.sqliteFiles.length > 0
        ? "sqlite_pending"
        : "inventory_only",
    findings
  };
}

function createResultBundle(catalog: BagCatalog, analysisMetrics: Metric[] = []): ResultBundle {
  return {
    appVersion: "0.0.0",
    createdAt: new Date().toISOString(),
    catalog,
    metrics: [...createInventoryMetrics(catalog), ...analysisMetrics],
    findings: catalog.findings
  };
}

function createInventoryMetrics(catalog: BagCatalog): Metric[] {
  const inventory = catalog.inventory;

  return [
    {
      id: "total-size",
      label: "Total size",
      value: inventory.totalSizeBytes,
      unit: "bytes"
    },
    {
      id: "file-count",
      label: "Files",
      value: inventory.files.length
    },
    {
      id: "sqlite-segments",
      label: "SQLite segments",
      value: inventory.sqliteFiles.length
    },
    {
      id: "embedded-metadata",
      label: "metadata.yaml",
      value: inventory.metadataFiles.length > 0 ? "present" : "missing"
    },
    {
      id: "message-definitions",
      label: "Local .msg/.idl",
      value: inventory.messageDefinitionFiles.length
    },
    {
      id: "message-count",
      label: "Messages",
      value: catalog.messageCount
    },
    {
      id: "storage-status",
      label: "Storage status",
      value: catalog.storageStatus
    }
  ];
}

function isCancelled(requestId: string): boolean {
  if (!cancelledRequests.has(requestId)) {
    return false;
  }

  cancelledRequests.delete(requestId);
  return true;
}

function postProgress(id: string, progress: WorkerProgress): void {
  postResponse({
    id,
    type: "progress",
    progress
  });
}

function postResponse(response: BagWorkerResponse): void {
  self.postMessage(response);
}
