import type { TopicCatalogEntry, TopicIntervalPoint } from "../model/result";
import { INTERVAL_GAP_WARNING_NS } from "../workers/analysis/interval_series";

const CHART_COLORS = {
  background: "#111713",
  grid: "#2a332f",
  label: "#d6ded9",
  axis: "#8ea39a",
  line: "#3ecfad",
  point: "#9cf2dc",
  warning: "#d9a441",
  warningFill: "rgba(217, 164, 65, 0.12)"
};

export interface IntervalChartOptions {
  gapWarningNs?: number;
}

export function drawIntervalChart(
  canvas: HTMLCanvasElement,
  topic: TopicCatalogEntry,
  series: readonly TopicIntervalPoint[],
  options: IntervalChartOptions = {}
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const gapWarningNs = options.gapWarningNs ?? INTERVAL_GAP_WARNING_NS;
  const ratio = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;
  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  context.clearRect(0, 0, cssWidth, cssHeight);
  context.fillStyle = CHART_COLORS.background;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 28, right: 20, bottom: 36, left: 52 };
  const plotWidth = cssWidth - padding.left - padding.right;
  const plotHeight = cssHeight - padding.top - padding.bottom;

  if (series.length === 0) {
    drawLabel(context, `No intervals for ${topic.name}`, padding.left, padding.top + 12, CHART_COLORS.label);
    return;
  }

  const startNs = series[0].timestampNs;
  const endNs = series[series.length - 1].timestampNs;
  const maxDeltaNs = Math.max(...series.map((point) => point.deltaNs), gapWarningNs, 1);
  const timeSpanNs = Math.max(endNs - startNs, 1);

  drawGrid(context, padding.left, padding.top, plotWidth, plotHeight);
  drawWarningLine(
    context,
    padding.left,
    padding.top,
    plotWidth,
    plotHeight,
    gapWarningNs,
    maxDeltaNs
  );

  context.strokeStyle = CHART_COLORS.line;
  context.lineWidth = 1.5;
  context.beginPath();

  series.forEach((point, index) => {
    const x = padding.left + ((point.timestampNs - startNs) / timeSpanNs) * plotWidth;
    const y = padding.top + plotHeight - (point.deltaNs / maxDeltaNs) * plotHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  for (const point of series) {
    const x = padding.left + ((point.timestampNs - startNs) / timeSpanNs) * plotWidth;
    const y = padding.top + plotHeight - (point.deltaNs / maxDeltaNs) * plotHeight;
    const color = point.deltaNs >= gapWarningNs ? CHART_COLORS.warning : CHART_COLORS.point;

    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, point.deltaNs >= gapWarningNs ? 3.5 : 2.5, 0, Math.PI * 2);
    context.fill();
  }

  drawLabel(
    context,
    `${topic.name} · message interval (s)`,
    padding.left,
    18,
    CHART_COLORS.label
  );
  drawLabel(context, "0", padding.left, cssHeight - 12, CHART_COLORS.axis);
  drawLabel(
    context,
    formatSeconds((endNs - startNs) / 1_000_000_000),
    padding.left + plotWidth - 24,
    cssHeight - 12,
    CHART_COLORS.axis
  );
  drawLabel(context, formatSeconds(maxDeltaNs / 1_000_000_000), 8, padding.top + 4, CHART_COLORS.axis);
  drawLabel(
    context,
    formatSeconds(gapWarningNs / 1_000_000_000),
    8,
    padding.top + plotHeight - (gapWarningNs / maxDeltaNs) * plotHeight - 4,
    CHART_COLORS.warning
  );
}

function drawGrid(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;

  for (let line = 0; line <= 4; line += 1) {
    const gridY = y + (height / 4) * line;
    context.beginPath();
    context.moveTo(x, gridY);
    context.lineTo(x + width, gridY);
    context.stroke();
  }
}

function drawWarningLine(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  gapWarningNs: number,
  maxDeltaNs: number
): void {
  const warningY = y + height - (gapWarningNs / maxDeltaNs) * height;

  context.fillStyle = CHART_COLORS.warningFill;
  context.fillRect(x, y, width, warningY - y);

  context.strokeStyle = CHART_COLORS.warning;
  context.setLineDash([6, 4]);
  context.beginPath();
  context.moveTo(x, warningY);
  context.lineTo(x + width, warningY);
  context.stroke();
  context.setLineDash([]);
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
): void {
  context.fillStyle = color;
  context.font = "11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText(text, x, y);
}

function formatSeconds(value: number): string {
  if (value >= 10) {
    return `${value.toFixed(0)}s`;
  }

  if (value >= 1) {
    return `${value.toFixed(1)}s`;
  }

  return `${value.toFixed(2)}s`;
}
