import sqlite3InitModule, { type Sqlite3Static } from "@sqlite.org/sqlite-wasm";
import { detectDirectFileVfsSupport } from "./direct_file_vfs";
import { cleanupStaleStaging, isOpfsSqliteAvailable } from "./opfs_fallback";

export interface SqliteRuntime {
  readonly available: boolean;
  readonly reason: string;
  readonly directFileVfsSupported: boolean;
  readonly opfsSqliteSupported: boolean;
}

let sqlite3Promise: Promise<Sqlite3Static> | null = null;
let workerBootstrapPromise: Promise<void> | null = null;

export async function bootstrapSqliteRuntime(): Promise<SqliteRuntime> {
  try {
    const sqlite3 = await getSqlite3();
    const directFileVfs = detectDirectFileVfsSupport();
    const opfsSqliteSupported = isOpfsSqliteAvailable(sqlite3);

    return {
      available: true,
      directFileVfsSupported: directFileVfs.supported,
      opfsSqliteSupported,
      reason: directFileVfs.supported
        ? "SQLite Wasm is ready with DirectFileVFS."
        : opfsSqliteSupported
          ? "SQLite Wasm is ready; large bags can fall back to OPFS staging."
          : `SQLite Wasm is ready; DirectFileVFS unavailable (${directFileVfs.reason}).`
    };
  } catch (error) {
    return {
      available: false,
      directFileVfsSupported: false,
      opfsSqliteSupported: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

export function getSqlite3(): Promise<Sqlite3Static> {
  sqlite3Promise ??= sqlite3InitModule();
  workerBootstrapPromise ??= sqlite3Promise.then(async (sqlite3) => {
    await cleanupStaleStaging(sqlite3);
  });

  return sqlite3Promise;
}

export function ensureWorkerSqliteBootstrap(): Promise<void> {
  return workerBootstrapPromise ?? getSqlite3().then(() => undefined);
}
