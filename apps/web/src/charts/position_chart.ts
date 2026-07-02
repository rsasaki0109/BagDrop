export interface PositionPoint {
  x: number;
  y: number;
}

export interface PositionChartOptions {
  title: string;
  emptyMessage: string;
  xAxisLabel: string;
  yAxisLabel: string;
  formatValue?: (value: number) => string;
}

const CHART_COLORS = {
  background: "#111713",
  grid: "#2a332f",
  label: "#d6ded9",
  axis: "#8ea39a",
  path: "#3ecfad",
  start: "#7dffb2",
  end: "#ff9d7d"
};

export function drawPositionChart(
  canvas: HTMLCanvasElement,
  series: readonly PositionPoint[],
  options: PositionChartOptions
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const formatValue = options.formatValue ?? formatAxis;
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
    drawLabel(context, options.emptyMessage, padding.left, padding.top + 12, CHART_COLORS.label);
    return;
  }

  const xs = series.map((point) => point.x);
  const ys = series.map((point) => point.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }

  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const dataWidth = maxX - minX;
  const dataHeight = maxY - minY;
  const scale = Math.min(plotWidth / dataWidth, plotHeight / dataHeight);
  const drawnWidth = dataWidth * scale;
  const drawnHeight = dataHeight * scale;
  const originX = padding.left + (plotWidth - drawnWidth) / 2;
  const originY = padding.top + (plotHeight + drawnHeight) / 2;

  drawGrid(context, padding.left, padding.top, plotWidth, plotHeight);

  const project = (point: PositionPoint): { x: number; y: number } => ({
    x: originX + (point.x - minX) * scale,
    y: originY - (point.y - minY) * scale
  });

  context.strokeStyle = CHART_COLORS.path;
  context.lineWidth = 1.75;
  context.beginPath();

  series.forEach((point, index) => {
    const projected = project(point);
    if (index === 0) {
      context.moveTo(projected.x, projected.y);
    } else {
      context.lineTo(projected.x, projected.y);
    }
  });

  context.stroke();

  drawMarker(context, project(series[0]), CHART_COLORS.start);
  drawMarker(context, project(series[series.length - 1]), CHART_COLORS.end);

  drawLabel(context, options.title, padding.left, 18, CHART_COLORS.label);
  drawLabel(context, formatValue(minX), padding.left, cssHeight - 12, CHART_COLORS.axis);
  drawLabel(context, formatValue(maxX), padding.left + plotWidth - 36, cssHeight - 12, CHART_COLORS.axis);
  drawLabel(context, formatValue(maxY), 8, padding.top + 8, CHART_COLORS.axis);
  drawLabel(context, formatValue(minY), 8, padding.top + plotHeight, CHART_COLORS.axis);
  drawLabel(context, options.xAxisLabel, padding.left + plotWidth - 88, 18, CHART_COLORS.start);
  drawLabel(context, options.yAxisLabel, padding.left + plotWidth - 36, 18, CHART_COLORS.end);
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

  for (let line = 0; line <= 4; line += 1) {
    const gridX = x + (width / 4) * line;
    context.beginPath();
    context.moveTo(gridX, y);
    context.lineTo(gridX, y + height);
    context.stroke();
  }
}

function drawMarker(
  context: CanvasRenderingContext2D,
  point: { x: number; y: number },
  color: string
): void {
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, 4, 0, Math.PI * 2);
  context.fill();
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

function formatAxis(value: number): string {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }

  if (Math.abs(value) >= 1) {
    return value.toFixed(1);
  }

  return value.toFixed(2);
}

export function formatGeoAxis(value: number): string {
  return value.toFixed(5);
}
