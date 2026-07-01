import type { Database, Sqlite3Result, Sqlite3Static, WasmPointer } from "@sqlite.org/sqlite-wasm";

export const DIRECT_FILE_VFS_NAME = "bagdrop-direct-file";

export interface DirectFileVfsSupport {
  supported: boolean;
  reason: string;
}

interface OpenDirectFile {
  name: string;
  file: File;
}

interface DirectFileVfsState {
  ioMethods: InstanceType<Sqlite3Static["capi"]["sqlite3_io_methods"]>;
  vfs: InstanceType<Sqlite3Static["capi"]["sqlite3_vfs"]>;
  registry: Map<string, File>;
  openFiles: Map<WasmPointer, OpenDirectFile>;
}

let installedState: DirectFileVfsState | null = null;

export function detectDirectFileVfsSupport(): DirectFileVfsSupport {
  if (!isWorkerLikeScope()) {
    return {
      supported: false,
      reason: "DirectFileVFS must run inside a Worker so synchronous file slices do not block the main thread."
    };
  }

  if (!fileReaderSyncCtor()) {
    return {
      supported: false,
      reason: "FileReaderSync is not available in this browser Worker."
    };
  }

  return {
    supported: true,
    reason: "FileReaderSync is available in the current Worker."
  };
}

export function registerDirectFile(sqlite3: Sqlite3Static, id: string, file: File): string {
  const state = ensureDirectFileVfs(sqlite3);
  const virtualName = `bdfile:${id}`;
  state.registry.set(virtualName, file);
  return virtualName;
}

export function unregisterDirectFile(virtualName: string): void {
  installedState?.registry.delete(virtualName);
}

export function openDirectFileDatabase(sqlite3: Sqlite3Static, virtualName: string): Database {
  ensureDirectFileVfs(sqlite3);
  return new sqlite3.oo1.DB({
    filename: virtualName,
    flags: "r",
    vfs: DIRECT_FILE_VFS_NAME
  });
}

export function readFileSliceSync(file: File, offset: number, length: number): Uint8Array {
  const ctor = fileReaderSyncCtor();
  if (!ctor) {
    throw new Error("FileReaderSync is not available in this execution context.");
  }

  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) {
    throw new Error(`Invalid file slice range: offset=${offset}, length=${length}`);
  }

  const end = Math.min(file.size, offset + length);
  const blob = file.slice(offset, end);
  const reader = new ctor();
  return new Uint8Array(reader.readAsArrayBuffer(blob));
}

function ensureDirectFileVfs(sqlite3: Sqlite3Static): DirectFileVfsState {
  const support = detectDirectFileVfsSupport();
  if (!support.supported) {
    throw new Error(support.reason);
  }

  if (installedState) {
    return installedState;
  }

  if (sqlite3.capi.sqlite3_vfs_find(DIRECT_FILE_VFS_NAME)) {
    throw new Error(`SQLite VFS already registered: ${DIRECT_FILE_VFS_NAME}`);
  }

  const state = createDirectFileVfsState(sqlite3);
  installedState = state;
  return state;
}

function createDirectFileVfsState(sqlite3: Sqlite3Static): DirectFileVfsState {
  const capi = sqlite3.capi;
  const wasm = sqlite3.wasm;
  const registry = new Map<string, File>();
  const openFiles = new Map<WasmPointer, OpenDirectFile>();

  const ioMethods = new capi.sqlite3_io_methods();
  (ioMethods as unknown as { $iVersion: number }).$iVersion = 1;

  const io: Partial<InstanceType<Sqlite3Static["capi"]["sqlite3_io_methods"]>> = {
    xCheckReservedLock: (_pFile, pOut) => {
      wasm.poke32(pOut, 0);
      return capi.SQLITE_OK;
    },
    xClose: (pFile) => {
      openFiles.delete(pFile);
      return capi.SQLITE_OK;
    },
    xDeviceCharacteristics: () =>
      (capi.SQLITE_IOCAP_IMMUTABLE | capi.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN) as Sqlite3Result,
    xFileControl: () => capi.SQLITE_NOTFOUND,
    xFileSize: (pFile, pSize) => {
      const openFile = openFiles.get(pFile);
      if (!openFile) {
        return capi.SQLITE_IOERR_FSTAT;
      }

      wasm.poke64(pSize, BigInt(openFile.file.size));
      return capi.SQLITE_OK;
    },
    xLock: () => capi.SQLITE_OK,
    xRead: (pFile, pDest, amount, offset) => {
      const openFile = openFiles.get(pFile);
      if (!openFile) {
        return capi.SQLITE_IOERR_READ;
      }

      try {
        const bytes = readFileSliceSync(openFile.file, Number(offset), amount);
        const start = Number(pDest);
        const heap = wasm.heap8u();
        heap.set(bytes, start);

        if (bytes.byteLength < amount) {
          heap.fill(0, start + bytes.byteLength, start + amount);
          return capi.SQLITE_IOERR_SHORT_READ;
        }

        return capi.SQLITE_OK;
      } catch {
        return capi.SQLITE_IOERR_READ;
      }
    },
    xSectorSize: () => 4096 as Sqlite3Result,
    xSync: () => capi.SQLITE_OK,
    xTruncate: () => capi.SQLITE_READONLY,
    xUnlock: () => capi.SQLITE_OK,
    xWrite: () => capi.SQLITE_READONLY
  };

  sqlite3.vfs.installVfs({
    io: {
      struct: ioMethods,
      methods: io
    }
  });

  const vfs = new capi.sqlite3_vfs();
  const defaultVfsPtr = capi.sqlite3_vfs_find(null);
  const defaultVfs = defaultVfsPtr ? new capi.sqlite3_vfs(defaultVfsPtr) : null;

  (vfs as unknown as { $iVersion: number }).$iVersion = 2;
  (vfs as unknown as { $szOsFile: number }).$szOsFile = (
    capi.sqlite3_file as unknown as { structInfo: { sizeof: number } }
  ).structInfo.sizeof;
  (vfs as unknown as { $mxPathname: number }).$mxPathname = 1024;

  if (defaultVfs) {
    (vfs as unknown as { $xRandomness?: WasmPointer }).$xRandomness = (
      defaultVfs as unknown as { $xRandomness?: WasmPointer }
    ).$xRandomness;
    (vfs as unknown as { $xSleep?: WasmPointer }).$xSleep = (
      defaultVfs as unknown as { $xSleep?: WasmPointer }
    ).$xSleep;
    defaultVfs.dispose();
  }

  const vfsMethods: Partial<InstanceType<Sqlite3Static["capi"]["sqlite3_vfs"]>> = {
    xAccess: (_pVfs, zName, flags, pOut) => {
      const name = wasm.cstrToJs(zName) ?? "";
      const exists = registry.has(name);
      const readable = flags !== capi.SQLITE_ACCESS_READWRITE;
      wasm.poke32(pOut, exists && readable ? 1 : 0);
      return capi.SQLITE_OK;
    },
    xCurrentTime: (_pVfs, pOut) => {
      wasm.poke(pOut, 2440587.5 + Date.now() / 86_400_000, "double");
      return capi.SQLITE_OK;
    },
    xCurrentTimeInt64: (_pVfs, pOut) => {
      wasm.poke64(pOut, BigInt(Math.trunc(2440587.5 * 86_400_000 + Date.now())));
      return capi.SQLITE_OK;
    },
    xDelete: () => capi.SQLITE_READONLY,
    xDlClose: () => undefined,
    xDlError: () => undefined,
    xDlOpen: () => 0,
    xDlSym: () => 0,
    xFullPathname: (_pVfs, zName, outLength, pOut) =>
      wasm.cstrncpy(pOut, zName, outLength) < outLength ? capi.SQLITE_OK : capi.SQLITE_CANTOPEN,
    xGetLastError: () => capi.SQLITE_OK,
    xGetSystemCall: () => 0,
    xNextSystemCall: () => 0,
    xOpen: (_pVfs, zName, pFile, flags, pOutFlags) => {
      const name = wasm.cstrToJs(zName) ?? "";
      const file = registry.get(name);

      if (!file || flags & capi.SQLITE_OPEN_CREATE || flags & capi.SQLITE_OPEN_READWRITE) {
        return capi.SQLITE_CANTOPEN;
      }

      openFiles.set(pFile, {
        name,
        file
      });

      const sqliteFile = new capi.sqlite3_file(pFile);
      (sqliteFile as unknown as { $pMethods: WasmPointer }).$pMethods = ioMethods.pointer;
      sqliteFile.dispose();
      wasm.poke32(pOutFlags, capi.SQLITE_OPEN_READONLY);
      return capi.SQLITE_OK;
    },
    xRandomness: (_pVfs, amount, pOut) => {
      const heap = wasm.heap8u();
      const start = Number(pOut);
      crypto.getRandomValues(heap.subarray(start, start + amount));
      return amount as Sqlite3Result;
    },
    xSetSystemCall: () => capi.SQLITE_NOTFOUND,
    xSleep: () => capi.SQLITE_OK
  };

  sqlite3.vfs.installVfs({
    vfs: {
      struct: vfs,
      methods: vfsMethods,
      name: DIRECT_FILE_VFS_NAME
    }
  });

  return {
    ioMethods,
    vfs,
    registry,
    openFiles
  };
}

function isWorkerLikeScope(): boolean {
  const workerScope = (globalThis as { WorkerGlobalScope?: new () => unknown }).WorkerGlobalScope;
  if (typeof workerScope === "function") {
    return globalThis instanceof workerScope;
  }

  return typeof document === "undefined";
}

function fileReaderSyncCtor():
  | (new () => {
      readAsArrayBuffer(blob: Blob): ArrayBuffer;
    })
  | null {
  const ctor = (globalThis as { FileReaderSync?: unknown }).FileReaderSync;
  return typeof ctor === "function"
    ? (ctor as new () => { readAsArrayBuffer(blob: Blob): ArrayBuffer })
    : null;
}
