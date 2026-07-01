import type { BagInventory } from "../model/result";

const KIND_COLORS: Record<string, string> = {
  metadata: "#4f7dff",
  sqlite: "#0f9f8f",
  mcap: "#8b6cff",
  message_definition: "#c07916",
  wal: "#d13b3b",
  journal: "#d13b3b",
  other: "#83908b"
};

export function drawInventoryChart(canvas: HTMLCanvasElement, inventory: BagInventory): void {
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
  context.fillStyle = "#111713";
  context.fillRect(0, 0, cssWidth, cssHeight);

  const padding = 24;
  const chartWidth = cssWidth - padding * 2;
  const chartHeight = cssHeight - padding * 2;

  context.strokeStyle = "#2a332f";
  context.lineWidth = 1;
  for (let line = 0; line <= 4; line += 1) {
    const y = padding + (chartHeight / 4) * line;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(cssWidth - padding, y);
    context.stroke();
  }

  if (inventory.files.length === 0) {
    drawLabel(context, "No files", padding, padding + 20, "#d6ded9");
    return;
  }

  const maxSize = Math.max(...inventory.files.map((file) => file.sizeBytes), 1);
  const gap = 4;
  const barWidth = Math.max(4, (chartWidth - gap * (inventory.files.length - 1)) / inventory.files.length);

  inventory.files.forEach((file, index) => {
    const normalized = Math.max(0.02, file.sizeBytes / maxSize);
    const height = Math.max(4, normalized * chartHeight);
    const x = padding + index * (barWidth + gap);
    const y = padding + chartHeight - height;

    context.fillStyle = KIND_COLORS[file.kind] ?? KIND_COLORS.other;
    context.fillRect(x, y, barWidth, height);
  });

  drawLabel(context, "File inventory by size", padding, 18, "#d6ded9");
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string
): void {
  context.fillStyle = color;
  context.font = "12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText(text, x, y);
}
