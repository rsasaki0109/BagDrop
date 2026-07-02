import type { ResultBundle, TopicCatalogEntry, WorkerProgress } from "../model/result";
import { drawInventoryChart } from "../charts/inventory_chart";
import { renderFindingsPanel, renderFindingsSummary, summarizeFindings } from "./findings_panel";
import { formatBytes, formatNumber } from "../ui/format";

export interface AppState {
  status: "idle" | "scanning" | "ready" | "error";
  progress: WorkerProgress | null;
  bundle: ResultBundle | null;
  error: string | null;
}

export interface AppActions {
  onDropFiles(event: DragEvent): Promise<void>;
  onPickFiles(): void;
  onPickDirectory(): void;
  onFileInput(fileList: FileList): Promise<void>;
  onCancel(): void;
  onClear(): void;
  onExportJson(): void;
}

export function renderApp(root: HTMLElement, state: AppState, actions: AppActions): void {
  root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand-lockup">
          <img class="brand-mark" src="${import.meta.env.BASE_URL}icons/bagdrop.svg" alt="" />
          <div>
            <h1>BagDrop</h1>
            <p>Local ROS 2 bag triage</p>
          </div>
        </div>
        <div class="topbar-actions">
          ${state.bundle ? `<button class="icon-button" id="export-json" type="button" title="Export JSON">JSON</button>` : ""}
          ${state.bundle ? `<button class="icon-button" id="clear" type="button" title="Clear result">Clear</button>` : ""}
          ${state.status === "scanning" ? `<button class="icon-button danger" id="cancel" type="button" title="Cancel scan">Cancel</button>` : ""}
        </div>
      </header>

      <section class="workspace">
        <section
          class="drop-panel ${state.status === "scanning" ? "is-busy" : ""}"
          id="drop-zone"
          aria-label="Drop ROS 2 bag files"
        >
          <input id="file-input" type="file" multiple hidden />
          <input id="directory-input" type="file" multiple webkitdirectory hidden />
          <div class="drop-content">
            <div class="drop-kicker">Drop a ROS 2 bag here</div>
            <div class="drop-title">Directory, split .db3 set, or single .db3</div>
            <div class="drop-actions">
              <button class="primary-button" id="pick-directory" type="button">Choose Directory</button>
              <button class="secondary-button" id="pick-files" type="button">Choose Files</button>
            </div>
            <div class="privacy-strip">
              <span>Files stay on this device</span>
              <span>No upload</span>
              <span>Works offline after first load</span>
            </div>
          </div>
        </section>

        <section class="dashboard">
          ${renderStatus(state)}
          ${state.bundle ? renderOverview(state.bundle) : renderEmptyDashboard()}
        </section>
      </section>
    </main>
  `;

  bindEvents(root, actions);
  const canvas = root.querySelector<HTMLCanvasElement>("#inventory-chart");
  if (canvas && state.bundle) {
    drawInventoryChart(canvas, state.bundle.catalog.inventory);
  }
}

function renderStatus(state: AppState): string {
  if (state.status === "error" && state.error) {
    return `
      <div class="status-row error">
        <span>Error</span>
        <strong>${escapeHtml(state.error)}</strong>
      </div>
    `;
  }

  if (state.status !== "scanning" || !state.progress) {
    return "";
  }

  const ratio = state.progress.ratio === null ? 0 : Math.max(0, Math.min(1, state.progress.ratio));
  return `
    <div class="status-row">
      <span>${escapeHtml(state.progress.phase)}</span>
      <strong>${escapeHtml(state.progress.message)}</strong>
      <progress class="progress-track" max="1" value="${ratio}" aria-label="Scan progress"></progress>
    </div>
  `;
}

function renderEmptyDashboard(): string {
  return `
    <div class="empty-state">
      <h2>Ready for local inspection</h2>
      <p>BagDrop will first inventory files and flag incomplete SQLite state before deeper catalog and analysis adapters run.</p>
    </div>
  `;
}

function renderOverview(bundle: ResultBundle): string {
  const catalog = bundle.catalog;
  const inventory = catalog.inventory;
  const findingSummary = summarizeFindings(bundle.findings);

  return `
    <section class="overview-grid" aria-label="Overview">
      ${metricCard("Total Size", formatBytes(inventory.totalSizeBytes))}
      ${metricCard("Files", formatNumber(inventory.files.length))}
      ${metricCard("SQLite Segments", formatNumber(inventory.sqliteFiles.length))}
      ${metricCard("Definitions", formatNumber(inventory.messageDefinitionFiles.length))}
      ${metricCard("Messages", catalog.messageCount === null ? "Pending" : formatNumber(catalog.messageCount))}
      ${metricCard("Topics", catalog.topics.length === 0 ? "None yet" : formatNumber(catalog.topics.length))}
      ${metricCard("Status", catalog.storageStatus)}
    </section>

    <section class="analysis-layout">
      <div class="panel">
        <div class="panel-heading">
          <h2>Storage Inventory</h2>
          <span>${escapeHtml(bundle.createdAt)}</span>
        </div>
        <canvas id="inventory-chart" class="inventory-chart" width="980" height="220"></canvas>
      </div>

      <div class="panel">
        <div class="panel-heading">
          <h2>Findings</h2>
          <span>${renderFindingsSummary(findingSummary)}</span>
        </div>
        ${renderFindingsPanel(bundle)}
      </div>
    </section>

    <section class="panel">
      <div class="panel-heading">
        <h2>Files</h2>
        <span>${formatBytes(inventory.totalSizeBytes)}</span>
      </div>
      ${renderFilesTable(bundle)}
    </section>

    <section class="panel">
      <div class="panel-heading">
        <h2>Topics</h2>
        <span>${catalog.storageStatus === "sqlite_pending" ? "Partial catalog" : catalog.storageStatus}</span>
      </div>
      ${renderTopics(bundle)}
    </section>
  `;
}

function renderTopicCdrSummary(topic: TopicCatalogEntry): string {
  if (topic.decodedPayloads === undefined || topic.decodedPayloads === null) {
    return topic.status === "unknown" ? "—" : "N/A";
  }

  const decodeErrors = topic.decodeErrors ?? 0;
  const total = topic.decodedPayloads + decodeErrors;

  if (total === 0) {
    return "No payloads";
  }

  if (decodeErrors === 0) {
    return `${formatNumber(topic.decodedPayloads)} ok`;
  }

  return `${formatNumber(topic.decodedPayloads)}/${formatNumber(total)} ok`;
}

function metricCard(label: string, value: string): string {
  return `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderFilesTable(bundle: ResultBundle): string {
  const rows = bundle.catalog.inventory.files
    .map(
      (file) => `
        <tr>
          <td>${escapeHtml(file.path)}</td>
          <td>${escapeHtml(file.kind)}</td>
          <td>${file.segmentOrdinal === null ? "" : formatNumber(file.segmentOrdinal)}</td>
          <td class="numeric">${formatBytes(file.sizeBytes)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>Kind</th>
            <th>Segment</th>
            <th class="numeric">Size</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderTopics(bundle: ResultBundle): string {
  if (bundle.catalog.topics.length === 0) {
    return `
      <div class="quiet-message">
        No topic catalog was produced. This usually means the input had no supported SQLite segment, was blocked by WAL/journal state, or exceeded the temporary in-memory catalog limit.
      </div>
    `;
  }

  const rows = bundle.catalog.topics
    .map(
      (topic) => `
        <tr>
          <td>${escapeHtml(topic.name)}</td>
          <td>${escapeHtml(topic.type)}</td>
          <td class="numeric">${topic.count === null ? "N/A" : formatNumber(topic.count)}</td>
          <td class="numeric">${topic.meanRateHz === null ? "N/A" : `${formatNumber(topic.meanRateHz)} Hz`}</td>
          <td class="numeric">${topic.maxGapNs === null ? "N/A" : `${formatNumber(topic.maxGapNs / 1_000_000_000)} s`}</td>
          <td class="numeric">${renderTopicCdrSummary(topic)}</td>
          <td>${escapeHtml(topic.status)}</td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Topic</th>
            <th>Type</th>
            <th class="numeric">Count</th>
            <th class="numeric">Mean Rate</th>
            <th class="numeric">Max Gap</th>
            <th class="numeric">CDR</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function bindEvents(root: HTMLElement, actions: AppActions): void {
  const dropZone = root.querySelector<HTMLElement>("#drop-zone");
  dropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
  dropZone?.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragging");
  });
  dropZone?.addEventListener("drop", (event) => {
    dropZone.classList.remove("is-dragging");
    void actions.onDropFiles(event);
  });

  root.querySelector("#pick-files")?.addEventListener("click", actions.onPickFiles);
  root.querySelector("#pick-directory")?.addEventListener("click", actions.onPickDirectory);
  root.querySelector("#cancel")?.addEventListener("click", actions.onCancel);
  root.querySelector("#clear")?.addEventListener("click", actions.onClear);
  root.querySelector("#export-json")?.addEventListener("click", actions.onExportJson);

  root.querySelector<HTMLInputElement>("#file-input")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) {
      void actions.onFileInput(input.files);
      input.value = "";
    }
  });

  root.querySelector<HTMLInputElement>("#directory-input")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) {
      void actions.onFileInput(input.files);
      input.value = "";
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
