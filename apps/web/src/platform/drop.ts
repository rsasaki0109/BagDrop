import type { WorkerFileRef } from "../model/worker_messages";

type BrowserFileSystemFileHandle = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
};

type BrowserFileSystemDirectoryHandle = {
  kind: "directory";
  name: string;
  values(): AsyncIterable<BrowserFileSystemHandle>;
};

type BrowserFileSystemHandle = BrowserFileSystemFileHandle | BrowserFileSystemDirectoryHandle;

type WebkitFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
};

type WebkitFileSystemFileEntry = WebkitFileSystemEntry & {
  file(success: (file: File) => void, failure: (error: DOMException) => void): void;
};

type WebkitFileSystemDirectoryEntry = WebkitFileSystemEntry & {
  createReader(): {
    readEntries(
      success: (entries: WebkitFileSystemEntry[]) => void,
      failure: (error: DOMException) => void
    ): void;
  };
};

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<WorkerFileRef[]> {
  const items = [...dataTransfer.items];

  if (items.length > 0) {
    const handleFiles = await collectFromFileSystemHandles(items);
    if (handleFiles.length > 0) {
      return normalizeFileRefs(handleFiles);
    }

    const webkitFiles = await collectFromWebkitEntries(items);
    if (webkitFiles.length > 0) {
      return normalizeFileRefs(webkitFiles);
    }
  }

  return filesFromFileList(dataTransfer.files);
}

export function filesFromFileList(fileList: FileList): WorkerFileRef[] {
  const files = [...fileList].map((file) => ({
    path: filePath(file),
    file
  }));

  return normalizeFileRefs(files);
}

async function collectFromFileSystemHandles(
  items: DataTransferItem[]
): Promise<Array<{ path: string; file: File }>> {
  const collected: Array<{ path: string; file: File }> = [];

  for (const item of items) {
    const getAsFileSystemHandle = (item as DataTransferItem & {
      getAsFileSystemHandle?: () => Promise<BrowserFileSystemHandle | null>;
    }).getAsFileSystemHandle;

    if (!getAsFileSystemHandle) {
      return [];
    }

    const handle = await getAsFileSystemHandle.call(item);
    if (handle) {
      await walkFileSystemHandle(handle, handle.name, collected);
    }
  }

  return collected;
}

async function walkFileSystemHandle(
  handle: BrowserFileSystemHandle,
  path: string,
  collected: Array<{ path: string; file: File }>
): Promise<void> {
  if (handle.kind === "file") {
    collected.push({
      path,
      file: await handle.getFile()
    });
    return;
  }

  for await (const child of handle.values()) {
    await walkFileSystemHandle(child, `${path}/${child.name}`, collected);
  }
}

async function collectFromWebkitEntries(
  items: DataTransferItem[]
): Promise<Array<{ path: string; file: File }>> {
  const collected: Array<{ path: string; file: File }> = [];

  for (const item of items) {
    const entry = (item as DataTransferItem & {
      webkitGetAsEntry?: () => WebkitFileSystemEntry | null;
    }).webkitGetAsEntry?.();

    if (!entry) {
      continue;
    }

    await walkWebkitEntry(entry, collected);
  }

  return collected;
}

async function walkWebkitEntry(
  entry: WebkitFileSystemEntry,
  collected: Array<{ path: string; file: File }>
): Promise<void> {
  if (entry.isFile) {
    const file = await readWebkitFile(entry as WebkitFileSystemFileEntry);
    collected.push({
      path: stripLeadingSlash(entry.fullPath || file.name),
      file
    });
    return;
  }

  if (!entry.isDirectory) {
    return;
  }

  const directory = entry as WebkitFileSystemDirectoryEntry;
  const reader = directory.createReader();

  while (true) {
    const entries = await readWebkitEntries(reader);
    if (entries.length === 0) {
      return;
    }

    for (const child of entries) {
      await walkWebkitEntry(child, collected);
    }
  }
}

function readWebkitFile(entry: WebkitFileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readWebkitEntries(
  reader: ReturnType<WebkitFileSystemDirectoryEntry["createReader"]>
): Promise<WebkitFileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries(resolve, reject);
  });
}

function normalizeFileRefs(files: Array<{ path: string; file: File }>): WorkerFileRef[] {
  return files
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }))
    .map((entry, index) => ({
      id: `file-${index}-${stablePathHash(entry.path)}`,
      path: entry.path,
      file: entry.file
    }));
}

function filePath(file: File): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return path && path.length > 0 ? path : file.name;
}

function stripLeadingSlash(path: string): string {
  return path.startsWith("/") ? path.slice(1) : path;
}

function stablePathHash(path: string): string {
  let hash = 2166136261;
  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
