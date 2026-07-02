import type { TopicCatalogEntry, TopicScanProfile } from "../model/result";

const CHART_COLORS = {
  background: "#111713",
  grid: "#2a332f",
  label: "#d6ded9",
  axis: "#8ea39a",
  line: "#6fae92",
  point: "#b8e0c8"
};

export function drawRangeChart(
  canvas: HTMLCanvasElement,
  topic: TopicCatalogEntry,
  profile: TopicScanProfile
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

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

  const points = profile.ranges
    .map((range, index) => ({
      angleRad: profile.angleMin + index * profile.angleIncrement,
      range
    }))
    .filter((point) => Number.isFinite(point.range) && point.range > 0);

  if (points.length === 0) {
    drawLabel(context, `No valid ranges for ${topic.name}`, padding.left, padding.top + 12, CHART_COLORS.label);
    return;
  }

  const minAngle = points[0].angleRad;
  const maxAngle = points[points.length - 1].angleRad;
  const angleSpan = Math.max(maxAngle - minAngle, 1e-9);
  const ranges = points.map((point) => point.range);
  const minRange = Math.min(...ranges);
  const maxRange = Math.max(...ranges);
  const rangeSpan = Math.max(maxRange - minRange, 1e-9);

  drawGrid(context, padding.left, padding.top, plotWidth, plotHeight);

  context.strokeStyle = CHART_COLORS.line;
  context.lineWidth = 1.5;
  context.beginPath();

  points.forEach((point, index) => {
    const x = padding.left + ((point.angleRad - minAngle) / angleSpan) * plotWidth;
    const y = padding.top + plotHeight - ((point.range - minRange) / rangeSpan) * plotHeight;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  drawLabel(
    context,
    `${topic.name} · latest scan profile`,
    padding.left,
    18,
    CHART_COLORS.label
  );
  drawLabel(context, formatDegrees(minAngle), padding.left, cssHeight - 12, CHART_COLORS.axis);
  drawLabel(context, formatDegrees(maxAngle), padding.left + plotWidth - 28, cssHeight - 12, CHART_COLORS.axis);
  drawLabel(context, formatAxisValue(maxRange), 8, padding.top + 4, CHART_COLORS.axis);
  drawLabel(context, formatAxisValue(minRange), 8, padding.top + plotHeight - 4, CHART_COLORS.axis);
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

function formatDegrees(radians: number): string {
  return `${((radians * 180) / Math.PI).toFixed(0)}°`;
}

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toFixed(0);
  }

  if (abs >= 10) {
    return value.toFixed(1);
  }

  if (abs >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(3);
}
