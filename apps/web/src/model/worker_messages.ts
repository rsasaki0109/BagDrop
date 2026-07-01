import type { BagCatalog, ResultBundle, WorkerProgress } from "./result";

export interface WorkerFileRef {
  id: string;
  path: string;
  file: File;
}

export type BagWorkerRequest =
  | {
      id: string;
      type: "scan";
      files: WorkerFileRef[];
    }
  | {
      id: string;
      type: "cancel";
    };

export type BagWorkerResponse =
  | {
      id: string;
      type: "progress";
      progress: WorkerProgress;
    }
  | {
      id: string;
      type: "catalog";
      catalog: BagCatalog;
      bundle: ResultBundle;
    }
  | {
      id: string;
      type: "error";
      message: string;
      stack?: string;
    };
