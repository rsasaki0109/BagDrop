import "./styles.css";
import { renderApp, type AppActions, type AppState } from "./app/render";
import { collectDroppedFiles, filesFromFileList } from "./platform/drop";
import { BagWorkerClient } from "./workers/worker_client";
import { downloadResultBundle } from "./report/export";

const rootElement = document.querySelector<HTMLDivElement>("#app");

if (!rootElement) {
  throw new Error("Missing #app root element.");
}

const root = rootElement;

const workerClient = new BagWorkerClient();

let state: AppState = {
  status: "idle",
  progress: null,
  bundle: null,
  error: null
};

const actions: AppActions = {
  onDropFiles: async (event) => {
    event.preventDefault();
    if (!event.dataTransfer) {
      return;
    }

    const files = await collectDroppedFiles(event.dataTransfer);
    await scanFiles(files);
  },
  onPickFiles: () => {
    root.querySelector<HTMLInputElement>("#file-input")?.click();
  },
  onPickDirectory: () => {
    root.querySelector<HTMLInputElement>("#directory-input")?.click();
  },
  onFileInput: async (fileList) => {
    await scanFiles(filesFromFileList(fileList));
  },
  onCancel: () => {
    workerClient.cancel();
    setState({
      ...state,
      status: "idle",
      progress: null
    });
  },
  onClear: () => {
    setState({
      status: "idle",
      progress: null,
      bundle: null,
      error: null
    });
  },
  onExportJson: () => {
    if (state.bundle) {
      downloadResultBundle(state.bundle);
    }
  }
};

render();
registerServiceWorker();

async function scanFiles(files: Parameters<BagWorkerClient["scan"]>[0]): Promise<void> {
  if (files.length === 0) {
    return;
  }

  setState({
    ...state,
    status: "scanning",
    progress: {
      phase: "inventory",
      message: "Starting scan",
      ratio: null
    },
    error: null
  });

  try {
    const bundle = await workerClient.scan(files, (progress) => {
      setState({
        ...state,
        status: "scanning",
        progress
      });
    });

    setState({
      status: "ready",
      progress: null,
      bundle,
      error: null
    });
  } catch (error) {
    setState({
      ...state,
      status: "error",
      progress: null,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function setState(nextState: AppState): void {
  state = nextState;
  render();
}

function render(): void {
  renderApp(root, state, actions);
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}
