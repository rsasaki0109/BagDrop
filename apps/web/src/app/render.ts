import type { ResultBundle, TopicCatalogEntry, WorkerProgress } from "../model/result";
import { drawInventoryChart } from "../charts/inventory_chart";
import { drawIntervalChart } from "../charts/interval_chart";
import { drawTrajectoryChart } from "../charts/xy_chart";
import { drawGeopointChart } from "../charts/latlon_chart";
import { drawValueChart } from "../charts/value_chart";
import { computeBagHealth, renderBagHealthBadge } from "./bag_health";
import { renderFindingsPanel, renderFindingsSummary, summarizeFindings } from "./findings_panel";
import { formatBytes, formatNumber } from "../ui/format";

export type TopicPlotKind = "intervals" | "xy" | "latlon" | "value";

export interface AppState {
  status: "idle" | "scanning" | "ready" | "error";
  progress: WorkerProgress | null;
  bundle: ResultBundle | null;
  selectedTopicName: string | null;
  selectedPlotKind: TopicPlotKind;
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
  onTopicSelect(topicName: string | null): void;
  onPlotKindSelect(plotKind: TopicPlotKind): void;
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
          ${state.bundle ? renderOverview(state.bundle, state.selectedTopicName, state.selectedPlotKind) : renderEmptyDashboard()}
        </section>
      </section>
    </main>
  `;

  bindEvents(root, state, actions);
  const canvas = root.querySelector<HTMLCanvasElement>("#inventory-chart");
  if (canvas && state.bundle) {
    drawInventoryChart(canvas, state.bundle.catalog.inventory);
  }

  const plotCanvas = root.querySelector<HTMLCanvasElement>("#topic-plot-canvas");
  if (plotCanvas && state.bundle && state.selectedTopicName) {
    const topic = state.bundle.catalog.topics.find((entry) => entry.name === state.selectedTopicName);
    if (topic) {
      const activePlotKind = resolveActivePlotKind(topic, state.selectedPlotKind);
      if (activePlotKind === "value" && topic.valueSeries) {
        drawValueChart(plotCanvas, topic, topic.valueSeries);
      } else if (activePlotKind === "latlon" && topic.geopointSeries) {
        drawGeopointChart(plotCanvas, topic, topic.geopointSeries);
      } else if (activePlotKind === "xy" && topic.trajectorySeries) {
        drawTrajectoryChart(plotCanvas, topic, topic.trajectorySeries);
      } else if (topic.intervalSeries) {
        drawIntervalChart(plotCanvas, topic, topic.intervalSeries);
      }
    }
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

function renderOverview(bundle: ResultBundle, selectedTopicName: string | null, selectedPlotKind: TopicPlotKind): string {
  const catalog = bundle.catalog;
  const inventory = catalog.inventory;
  const findingSummary = summarizeFindings(bundle.findings);
  const bagHealth = computeBagHealth(bundle);

  return `
    <section class="overview-grid" aria-label="Overview">
      ${metricCard("Total Size", formatBytes(inventory.totalSizeBytes))}
      ${metricCard("Files", formatNumber(inventory.files.length))}
      ${metricCard("SQLite Segments", formatNumber(inventory.sqliteFiles.length))}
      ${metricCard("Definitions", formatNumber(inventory.messageDefinitionFiles.length))}
      ${metricCard("Messages", catalog.messageCount === null ? "Pending" : formatNumber(catalog.messageCount))}
      ${metricCard("Topics", catalog.topics.length === 0 ? "None yet" : formatNumber(catalog.topics.length))}
      ${renderBagHealthCard(bagHealth)}
      ${metricCard("Storage", catalog.storageStatus)}
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
      ${renderTopics(bundle, selectedTopicName)}
    </section>

    ${renderTopicPlotPanel(bundle, selectedTopicName, selectedPlotKind)}
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

function renderBagHealthCard(health: ReturnType<typeof computeBagHealth>): string {
  return `
    <div class="metric-card health-card health-${health.level}" title="${escapeHtml(health.detail)}">
      <span>Bag Health</span>
      <strong class="health-card-value">${renderBagHealthBadge(health)}</strong>
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

function renderTopics(bundle: ResultBundle, selectedTopicName: string | null): string {
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
        <tr class="topic-row ${selectedTopicName === topic.name ? "is-selected" : ""}" data-topic-name="${escapeHtml(topic.name)}" tabindex="0" role="button" aria-pressed="${selectedTopicName === topic.name ? "true" : "false"}">
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

function renderTopicPlotPanel(
  bundle: ResultBundle,
  selectedTopicName: string | null,
  selectedPlotKind: TopicPlotKind
): string {
  if (!selectedTopicName) {
    return `
      <section class="panel topic-plot-panel">
        <div class="panel-heading">
          <h2>Topic Plot</h2>
          <span>Select a topic</span>
        </div>
        <div class="quiet-message">Choose a topic row to inspect message intervals, scalar time series, odometry trajectories, or GNSS lat/lon tracks.</div>
      </section>
    `;
  }

  const topic = bundle.catalog.topics.find((entry) => entry.name === selectedTopicName);
  if (!topic) {
    return "";
  }

  const intervalCount = topic.intervalSeries?.length ?? 0;
  const trajectoryCount = topic.trajectorySeries?.length ?? 0;
  const geopointCount = topic.geopointSeries?.length ?? 0;
  const valueCount = topic.valueSeries?.length ?? 0;
  const hasTrajectory = trajectoryCount > 0;
  const hasGeopoints = geopointCount > 0;
  const hasValues = valueCount > 0;
  const activePlotKind = resolveActivePlotKind(topic, selectedPlotKind);
  const pointCount =
    activePlotKind === "xy"
      ? trajectoryCount
      : activePlotKind === "latlon"
        ? geopointCount
        : activePlotKind === "value"
          ? valueCount
          : intervalCount;
  const plotCopy =
    activePlotKind === "xy"
      ? "Pose projected to x/y. Green marks the first pose and orange marks the last."
      : activePlotKind === "latlon"
        ? "NavSatFix latitude and longitude track. Green marks the first fix and orange marks the last."
        : activePlotKind === "value"
          ? `Decoded ${topic.type} values over bag time.`
          : `Message interval Δt (seconds) vs bag time. Orange line marks the ${formatNumber(5)} s large-gap warning threshold.`;

  return `
    <section class="panel topic-plot-panel">
      <div class="panel-heading">
        <h2>Topic Plot</h2>
        <span>${escapeHtml(topic.name)} · ${formatNumber(pointCount)} points</span>
      </div>
      <div class="topic-plot-tabs" role="tablist" aria-label="Topic plot type">
        <button
          class="topic-plot-tab ${activePlotKind === "intervals" ? "is-active" : ""}"
          type="button"
          role="tab"
          aria-selected="${activePlotKind === "intervals" ? "true" : "false"}"
          data-plot-kind="intervals"
        >
          Intervals
        </button>
        <button
          class="topic-plot-tab ${activePlotKind === "value" ? "is-active" : ""} ${hasValues ? "" : "is-disabled"}"
          type="button"
          role="tab"
          aria-selected="${activePlotKind === "value" ? "true" : "false"}"
          data-plot-kind="value"
          ${hasValues ? "" : "disabled"}
        >
          Value
        </button>
        <button
          class="topic-plot-tab ${activePlotKind === "xy" ? "is-active" : ""} ${hasTrajectory ? "" : "is-disabled"}"
          type="button"
          role="tab"
          aria-selected="${activePlotKind === "xy" ? "true" : "false"}"
          data-plot-kind="xy"
          ${hasTrajectory ? "" : "disabled"}
        >
          XY trajectory
        </button>
        <button
          class="topic-plot-tab ${activePlotKind === "latlon" ? "is-active" : ""} ${hasGeopoints ? "" : "is-disabled"}"
          type="button"
          role="tab"
          aria-selected="${activePlotKind === "latlon" ? "true" : "false"}"
          data-plot-kind="latlon"
          ${hasGeopoints ? "" : "disabled"}
        >
          Lat/Lon
        </button>
      </div>
      <div class="topic-plot-copy">${plotCopy}</div>
      <canvas id="topic-plot-canvas" class="topic-plot-canvas" width="980" height="260" aria-label="Topic plot for ${escapeHtml(topic.name)}"></canvas>
    </section>
  `;
}

function resolveActivePlotKind(topic: TopicCatalogEntry, selectedPlotKind: TopicPlotKind): TopicPlotKind {
  if (selectedPlotKind === "value" && (topic.valueSeries?.length ?? 0) > 0) {
    return "value";
  }

  if (selectedPlotKind === "latlon" && (topic.geopointSeries?.length ?? 0) > 0) {
    return "latlon";
  }

  if (selectedPlotKind === "xy" && (topic.trajectorySeries?.length ?? 0) > 0) {
    return "xy";
  }

  return "intervals";
}

function bindEvents(root: HTMLElement, state: AppState, actions: AppActions): void {
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

  for (const row of root.querySelectorAll<HTMLElement>(".topic-row")) {
    const topicName = row.dataset.topicName;
    if (!topicName) {
      continue;
    }

    const selectTopic = () => {
      actions.onTopicSelect(state.selectedTopicName === topicName ? null : topicName);
    };

    row.addEventListener("click", selectTopic);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectTopic();
      }
    });
  }

  for (const tab of root.querySelectorAll<HTMLButtonElement>(".topic-plot-tab:not(.is-disabled)")) {
    tab.addEventListener("click", () => {
      const plotKind = tab.dataset.plotKind;
      if (plotKind === "intervals" || plotKind === "xy" || plotKind === "latlon" || plotKind === "value") {
        actions.onPlotKindSelect(plotKind);
      }
    });
  }

  for (const topicLink of root.querySelectorAll<HTMLButtonElement>(".finding-topic-link")) {
    const topicName = topicLink.dataset.topicName;
    if (!topicName) {
      continue;
    }

    topicLink.addEventListener("click", () => {
      actions.onTopicSelect(topicName);
      root.querySelector(`tr[data-topic-name="${CSS.escape(topicName)}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
      });
    });
  }

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
