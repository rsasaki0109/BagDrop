import type { BagCatalog, ResultBundle, WorkerProgress } from "./result";
import type { BagdropTestHooks } from "../workers/test_hooks";

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
      testHooks?: BagdropTestHooks;
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
