import type { ResultBundle, WorkerProgress } from "../model/result";
import type { BagWorkerRequest, BagWorkerResponse, WorkerFileRef } from "../model/worker_messages";

export type ProgressHandler = (progress: WorkerProgress) => void;

export class BagWorkerClient {
  private worker: Worker;
  private activeRequestId: string | null = null;

  constructor() {
    this.worker = new Worker(new URL("./bag.worker.ts", import.meta.url), {
      type: "module",
      name: "bagdrop-bag-worker"
    });
  }

  scan(files: WorkerFileRef[], onProgress: ProgressHandler): Promise<ResultBundle> {
    if (this.activeRequestId) {
      this.cancel();
    }

    const requestId = requestIdFor("scan");
    this.activeRequestId = requestId;

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<BagWorkerResponse>) => {
        const response = event.data;
        if (response.id !== requestId) {
          return;
        }

        if (response.type === "progress") {
          onProgress(response.progress);
          return;
        }

        this.worker.removeEventListener("message", handleMessage);
        this.activeRequestId = null;

        if (response.type === "catalog") {
          resolve(response.bundle);
          return;
        }

        const error = new Error(response.message);
        if (response.stack) {
          error.stack = response.stack;
        }
        reject(error);
      };

      this.worker.addEventListener("message", handleMessage);
      this.worker.postMessage({
        id: requestId,
        type: "scan",
        files
      } satisfies BagWorkerRequest);
    });
  }

  cancel(): void {
    if (!this.activeRequestId) {
      return;
    }

    this.worker.postMessage({
      id: this.activeRequestId,
      type: "cancel"
    } satisfies BagWorkerRequest);
    this.activeRequestId = null;
  }

  destroy(): void {
    this.worker.terminate();
    this.activeRequestId = null;
  }
}

function requestIdFor(prefix: string): string {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
