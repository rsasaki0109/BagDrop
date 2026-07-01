import type { Database, Sqlite3Static } from "@sqlite.org/sqlite-wasm";

export const OPFS_STAGING_DIR = "/bagdrop/staging";
export const OPFS_IMPORT_CHUNK_BYTES = 4 * 1024 * 1024;

export interface StorageEstimate {
  quota: number | null;
  usage: number | null;
  available: number | null;
}

interface SqliteOpfsUtil {
  thisThreadHasOPFS: () => boolean;
  getDirForFilename: (
    absFilename: string,
    createDirs?: boolean
  ) => Promise<[FileSystemDirectoryHandle, string]>;
  entryExists: (fsEntryName: string) => Promise<boolean>;
  unlink: (fsEntryName: string, recursive?: boolean, throwOnError?: boolean) => Promise<boolean>;
  traverse: (options: {
    directory?: FileSystemDirectoryHandle;
    recursive?: boolean;
    callback: (
      handle: FileSystemHandle,
      parent: FileSystemDirectoryHandle,
      depth: number
    ) => boolean | void | Promise<boolean | void>;
  }) => Promise<void>;
}

export async function hasOpfsSupport(): Promise<boolean> {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<unknown>;
  };
  return typeof storage.getDirectory === "function";
}

export async function estimateStorage(): Promise<StorageEstimate> {
  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? null;
  const usage = estimate.usage ?? null;

  return {
    quota,
    usage,
    available: quota === null || usage === null ? null : Math.max(0, quota - usage)
  };
}

export async function canStageFileInOpfs(file: File, headroomRatio = 1.15): Promise<boolean> {
  if (!(await hasOpfsSupport())) {
    return false;
  }

  const estimate = await estimateStorage();
  if (estimate.available === null) {
    return true;
  }

  return estimate.available >= file.size * headroomRatio;
}

export function isOpfsSqliteAvailable(sqlite3: Sqlite3Static): boolean {
  if (!("opfs" in sqlite3) || !sqlite3.oo1.OpfsDb) {
    return false;
  }

  const opfs = getOpfsUtil(sqlite3);
  return opfs?.thisThreadHasOPFS() ?? false;
}

export function stagingPathForId(id: string): string {
  const safeId = id.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
  return `${OPFS_STAGING_DIR}/${safeId}.db3`;
}

export function createSQLiteImportChunkReader(
  file: File,
  chunkSize = OPFS_IMPORT_CHUNK_BYTES
): () => Promise<Uint8Array | undefined> {
  let offset = 0;

  return async () => {
    if (offset >= file.size) {
      return undefined;
    }

    const end = Math.min(file.size, offset + chunkSize);
    const buffer = await file.slice(offset, end).arrayBuffer();
    offset = end;
    return new Uint8Array(buffer);
  };
}

export async function stageFileToOpfsSqlite(
  sqlite3: Sqlite3Static,
  file: File,
  stagingPath: string
): Promise<number> {
  const OpfsDb = sqlite3.oo1.OpfsDb;
  if (!OpfsDb) {
    throw new Error("SQLite OPFS backend is unavailable.");
  }

  return OpfsDb.importDb(stagingPath, createSQLiteImportChunkReader(file));
}

export function openStagedOpfsDatabase(sqlite3: Sqlite3Static, stagingPath: string): Database {
  const OpfsDb = sqlite3.oo1.OpfsDb;
  if (!OpfsDb) {
    throw new Error("SQLite OPFS backend is unavailable.");
  }

  return new OpfsDb(stagingPath, "r");
}

export async function removeStagedFile(sqlite3: Sqlite3Static, stagingPath: string): Promise<void> {
  const opfs = getOpfsUtil(sqlite3);
  if (!opfs) {
    return;
  }

  await opfs.unlink(stagingPath);
}

export async function cleanupStaleStaging(sqlite3: Sqlite3Static): Promise<number> {
  const opfs = getOpfsUtil(sqlite3);
  if (!opfs) {
    return 0;
  }

  const markerPath = `${OPFS_STAGING_DIR}/.keep`;
  if (!(await opfs.entryExists(markerPath))) {
    return 0;
  }

  const [stagingDir] = await opfs.getDirForFilename(markerPath, true);
  let removed = 0;

  await opfs.traverse({
    directory: stagingDir,
    recursive: false,
    callback: async (handle) => {
      if (handle.kind !== "file" || handle.name.startsWith(".")) {
        return;
      }

      const removedFile = await opfs.unlink(`${OPFS_STAGING_DIR}/${handle.name}`);
      if (removedFile) {
        removed += 1;
      }
    }
  });

  return removed;
}

function getOpfsUtil(sqlite3: Sqlite3Static): SqliteOpfsUtil | null {
  const opfs = (sqlite3 as Sqlite3Static & { opfs?: SqliteOpfsUtil }).opfs;
  if (!opfs) {
    return null;
  }

  return opfs;
}
