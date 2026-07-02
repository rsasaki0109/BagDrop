import type { TopicCatalogEntry, TopicGeopoint } from "../model/result";
import { drawPositionChart, formatGeoAxis } from "./position_chart";

export function drawGeopointChart(
  canvas: HTMLCanvasElement,
  topic: TopicCatalogEntry,
  series: readonly TopicGeopoint[]
): void {
  drawPositionChart(
    canvas,
    series.map((point) => ({ x: point.lon, y: point.lat })),
    {
      title: `${topic.name} · lat/lon`,
      emptyMessage: `No GNSS track for ${topic.name}`,
      xAxisLabel: "start",
      yAxisLabel: "end",
      formatValue: formatGeoAxis
    }
  );
}
