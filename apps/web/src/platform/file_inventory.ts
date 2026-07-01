import type { BagFileSummary, BagInventory, InventoryWarning } from "../model/result";
import type { WorkerFileRef } from "../model/worker_messages";

export function buildInventory(inputFiles: readonly WorkerFileRef[]): BagInventory {
  const sortedInput = [...inputFiles].sort((a, b) => naturalCompare(a.path, b.path));
  const sqlitePaths = sortedInput
    .filter((entry) => classifyPath(entry.path) === "sqlite")
    .map((entry) => entry.path);
  const sqliteOrdinalByPath = new Map(sqlitePaths.map((path, index) => [path, index]));

  const files = sortedInput.map<BagFileSummary>((entry) => {
    const kind = classifyPath(entry.path);
    return {
      id: entry.id,
      path: entry.path,
      name: entry.file.name,
      sizeBytes: entry.file.size,
      kind,
      segmentOrdinal: kind === "sqlite" ? sqliteOrdinalByPath.get(entry.path) ?? null : null
    };
  });

  const inventory: BagInventory = {
    files,
    totalSizeBytes: files.reduce((total, file) => total + file.sizeBytes, 0),
    metadataFiles: files.filter((file) => file.kind === "metadata"),
    sqliteFiles: files.filter((file) => file.kind === "sqlite"),
    mcapFiles: files.filter((file) => file.kind === "mcap"),
    messageDefinitionFiles: files.filter((file) => file.kind === "message_definition"),
    walFiles: files.filter((file) => file.kind === "wal"),
    journalFiles: files.filter((file) => file.kind === "journal"),
    warnings: []
  };

  inventory.warnings = collectInventoryWarnings(inventory);
  return inventory;
}

export function classifyPath(path: string): BagFileSummary["kind"] {
  const lower = path.toLowerCase();
  const name = basename(lower);

  if (name === "metadata.yaml" || name === "metadata.yml") {
    return "metadata";
  }

  if (lower.endsWith(".db3")) {
    return "sqlite";
  }

  if (lower.endsWith(".mcap")) {
    return "mcap";
  }

  if (lower.endsWith(".msg") || lower.endsWith(".idl")) {
    return "message_definition";
  }

  if (lower.endsWith("-wal") || lower.endsWith(".wal")) {
    return "wal";
  }

  if (lower.endsWith("-journal") || lower.endsWith(".journal")) {
    return "journal";
  }

  return "other";
}

export function collectInventoryWarnings(inventory: BagInventory): InventoryWarning[] {
  const warnings: InventoryWarning[] = [];

  if (inventory.sqliteFiles.length === 0 && inventory.mcapFiles.length === 0) {
    warnings.push({
      severity: "error",
      code: "no_storage_file",
      message: "No .db3 or .mcap storage file was found."
    });
  }

  if (inventory.mcapFiles.length > 0) {
    warnings.push({
      severity: "warning",
      code: "mcap_not_supported_yet",
      message: "MCAP files were detected, but the current MVP scaffold only inventories them."
    });
  }

  if (inventory.metadataFiles.length === 0 && inventory.sqliteFiles.length > 1) {
    warnings.push({
      severity: "warning",
      code: "split_bag_without_metadata",
      message: "Multiple .db3 files were found without metadata.yaml, so segment ordering is inferred from filenames."
    });
  }

  if (inventory.metadataFiles.length > 1) {
    warnings.push({
      severity: "warning",
      code: "multiple_metadata_files",
      message: "Multiple metadata.yaml files were found in the selected input."
    });
  }

  if (inventory.sqliteFiles.length > 0 && inventory.mcapFiles.length > 0) {
    warnings.push({
      severity: "warning",
      code: "mixed_storage_formats",
      message: "Both SQLite and MCAP storage files were detected. Storage adapters should analyze them as separate bag sources."
    });
  }

  for (const file of inventory.walFiles) {
    warnings.push({
      severity: "error",
      code: "wal_present",
      message: "A SQLite WAL file is present. Analyze only a checkpointed, complete bag in the MVP.",
      path: file.path
    });
  }

  for (const file of inventory.journalFiles) {
    warnings.push({
      severity: "error",
      code: "journal_present",
      message: "A SQLite journal file is present. The main database may not be in a stable checkpointed state.",
      path: file.path
    });
  }

  return warnings;
}

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}
