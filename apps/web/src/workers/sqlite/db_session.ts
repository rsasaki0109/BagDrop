import type { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import type { BagFileSummary, Finding } from "../../model/result";
import { getSqlite3 } from "./bootstrap";
import {
  detectDirectFileVfsSupport,
  openDirectFileDatabase,
  registerDirectFile,
  unregisterDirectFile
} from "./direct_file_vfs";
import {
  canStageFileInOpfs,
  isOpfsSqliteAvailable,
  openStagedOpfsDatabase,
  removeStagedFile,
  stageFileToOpfsSqlite,
  stagingPathForId
} from "./opfs_fallback";
import { getBagdropTestHooks } from "../test_hooks";

export const MAX_DESERIALIZE_DB_BYTES = 64 * 1024 * 1024;

export class SqliteSegmentDeferredError extends Error {
  constructor(
    message: string,
    readonly finding: Finding
  ) {
    super(message);
    this.name = "SqliteSegmentDeferredError";
  }
}

export async function withReadonlySegmentDatabase<T>(
  file: File,
  summary: BagFileSummary,
  callback: (db: Database) => T | Promise<T>
): Promise<T> {
  const sqlite3 = await getSqlite3();

  if (detectDirectFileVfsSupport().supported) {
    return withDirectFileDatabase(sqlite3, file, summary, callback);
  }

  const hooks = getBagdropTestHooks();
  if (!hooks.forceOpfsStaging && file.size <= MAX_DESERIALIZE_DB_BYTES) {
    return withDeserializeDatabase(sqlite3, file, callback);
  }

  if (!isOpfsSqliteAvailable(sqlite3)) {
    if (hooks.forceOpfsStaging) {
      return withDeserializeDatabase(sqlite3, file, callback);
    }

    throw new SqliteSegmentDeferredError(
      `SQLite access deferred for ${summary.path}`,
      createDeferredFinding(summary, "opfs_unavailable", {
        reason: "SQLite OPFS backend is unavailable in this browser Worker."
      })
    );
  }

  if (!(await canStageFileInOpfs(file))) {
    throw new SqliteSegmentDeferredError(
      `SQLite access deferred for ${summary.path}`,
      createDeferredFinding(summary, "opfs_quota", {
        reason: "Insufficient OPFS quota to stage this SQLite segment."
      })
    );
  }

  return withOpfsStagedDatabase(sqlite3, file, summary, callback);
}

async function withDirectFileDatabase<T>(
  sqlite3: Sqlite3Static,
  file: File,
  summary: BagFileSummary,
  callback: (db: Database) => T | Promise<T>
): Promise<T> {
  const virtualName = registerDirectFile(sqlite3, summary.id, file);
  const db = openDirectFileDatabase(sqlite3, virtualName);

  try {
    return await callback(db);
  } finally {
    db.close();
    unregisterDirectFile(virtualName);
  }
}

async function withDeserializeDatabase<T>(
  sqlite3: Sqlite3Static,
  file: File,
  callback: (db: Database) => T | Promise<T>
): Promise<T> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const db = deserializeReadonlyDatabase(sqlite3, bytes);

  try {
    return await callback(db);
  } finally {
    db.close();
  }
}

async function withOpfsStagedDatabase<T>(
  sqlite3: Sqlite3Static,
  file: File,
  summary: BagFileSummary,
  callback: (db: Database) => T | Promise<T>
): Promise<T> {
  const stagingPath = stagingPathForId(summary.id);

  try {
    await stageFileToOpfsSqlite(sqlite3, file, stagingPath);
    const db = openStagedOpfsDatabase(sqlite3, stagingPath);

    try {
      return await callback(db);
    } finally {
      db.close();
    }
  } finally {
    await removeStagedFile(sqlite3, stagingPath);
  }
}

function deserializeReadonlyDatabase(sqlite3: Sqlite3Static, bytes: Uint8Array): Database {
  const db = new sqlite3.oo1.DB(":memory:");
  const dataPtr = sqlite3.wasm.allocFromTypedArray(bytes);

  db.onclose = {
    after: () => {
      sqlite3.wasm.dealloc(dataPtr);
    }
  };

  try {
    const rc = sqlite3.capi.sqlite3_deserialize(
      db,
      "main",
      dataPtr,
      bytes.byteLength,
      bytes.byteLength,
      sqlite3.capi.SQLITE_DESERIALIZE_READONLY
    );
    db.checkRc(rc);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function createDeferredFinding(
  summary: BagFileSummary,
  reason: "opfs_unavailable" | "opfs_quota",
  evidence: Record<string, unknown>
): Finding {
  const detailByReason: Record<typeof reason, string> = {
    opfs_unavailable:
      `The file ${summary.path} is larger than the temporary ${formatMiB(MAX_DESERIALIZE_DB_BYTES)} ` +
      "in-memory catalog limit and DirectFileVFS is unavailable. OPFS staging is also unavailable.",
    opfs_quota:
      `The file ${summary.path} is larger than the temporary ${formatMiB(MAX_DESERIALIZE_DB_BYTES)} ` +
      "in-memory catalog limit and there is not enough OPFS quota to stage it."
  };

  return {
    id: `sqlite-file-too-large-${summary.id}`,
    severity: "warning",
    title: "SQLite catalog deferred",
    detail: detailByReason[reason],
    evidence: {
      path: summary.path,
      sizeBytes: summary.sizeBytes,
      maxDeserializeBytes: MAX_DESERIALIZE_DB_BYTES,
      ...evidence
    }
  };
}

function formatMiB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MiB`;
}
