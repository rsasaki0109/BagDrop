import type { ResultBundle } from "../model/result";
import { summarizeFindings } from "./findings_panel";

export type BagHealthLevel = "healthy" | "degraded" | "critical" | "pending" | "blocked";

export interface BagHealth {
  level: BagHealthLevel;
  label: string;
  detail: string;
  score: number | null;
}

export function computeBagHealth(bundle: ResultBundle): BagHealth {
  const summary = summarizeFindings(bundle.findings);
  const storageStatus = bundle.catalog.storageStatus;

  if (storageStatus === "blocked") {
    return {
      level: "blocked",
      label: "Blocked",
      detail: "Bag storage state prevents analysis.",
      score: 0
    };
  }

  if (storageStatus === "inventory_only" || storageStatus === "sqlite_pending") {
    return {
      level: "pending",
      label: "Pending",
      detail: "Catalog scan is incomplete.",
      score: null
    };
  }

  if (summary.errors > 0) {
    return {
      level: "critical",
      label: "Critical",
      detail: `${summary.errors} error${summary.errors === 1 ? "" : "s"} ${summary.errors === 1 ? "needs" : "need"} attention before trusting this bag.`,
      score: clampScore(100 - summary.errors * 35 - summary.warnings * 12)
    };
  }

  if (summary.warnings > 0) {
    return {
      level: "degraded",
      label: "Degraded",
      detail: `${summary.warnings} warning${summary.warnings === 1 ? "" : "s"} detected during scan.`,
      score: clampScore(100 - summary.warnings * 12 - summary.info * 3)
    };
  }

  return {
    level: "healthy",
    label: "Healthy",
    detail: "No findings from inventory, catalog, or stream analysis.",
    score: 100
  };
}

export function renderBagHealthBadge(health: BagHealth): string {
  const scoreMarkup =
    health.score === null
      ? ""
      : `<span class="health-score" aria-label="Health score">${health.score}</span>`;

  return `
    <span class="health-badge health-${health.level}">${escapeHtml(health.label)}</span>
    ${scoreMarkup}
  `;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
