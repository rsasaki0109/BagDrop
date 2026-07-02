import type { TopicCatalogEntry, TopicTrajectoryPoint } from "../model/result";
import { drawPositionChart } from "./position_chart";

export function drawTrajectoryChart(
  canvas: HTMLCanvasElement,
  topic: TopicCatalogEntry,
  series: readonly TopicTrajectoryPoint[]
): void {
  drawPositionChart(canvas, series, {
    title: `${topic.name} · pose x/y`,
    emptyMessage: `No trajectory for ${topic.name}`,
    xAxisLabel: "start",
    yAxisLabel: "end"
  });
}
