import type { Finding, ResultBundle } from "../model/result";
import { findingCategory, summarizeFindings } from "./findings_panel";

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
      detail: formatCriticalDetail(summary.errors, bundle.findings),
      score: clampScore(100 - summary.errors * 35 - summary.warnings * 12)
    };
  }

  if (summary.warnings > 0) {
    return {
      level: "degraded",
      label: "Degraded",
      detail: formatWarningDetail(summary.warnings, bundle.findings),
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

interface FindingCategoryCounts {
  diagnostics: number;
  stream: number;
  other: number;
}

function countFindingCategories(
  findings: readonly Finding[],
  severity: Finding["severity"]
): FindingCategoryCounts {
  const counts: FindingCategoryCounts = { diagnostics: 0, stream: 0, other: 0 };

  for (const finding of findings) {
    if (finding.severity !== severity) {
      continue;
    }

    const category = findingCategory(finding);
    if (category === "Diagnostics") {
      counts.diagnostics += 1;
    } else if (category === "Stream") {
      counts.stream += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

function formatCategoryBreakdown(counts: FindingCategoryCounts): string | null {
  const parts: string[] = [];

  if (counts.diagnostics > 0) {
    parts.push(`${counts.diagnostics} Diagnostics`);
  }

  if (counts.stream > 0) {
    parts.push(`${counts.stream} Stream`);
  }

  if (counts.other > 0) {
    parts.push(`${counts.other} Other`);
  }

  if (parts.length === 0) {
    return null;
  }

  return `Includes ${parts.join(" and ")}.`;
}

function formatCriticalDetail(errorCount: number, findings: readonly Finding[]): string {
  const base =
    errorCount === 1
      ? "1 error needs attention before trusting this bag."
      : `${errorCount} errors need attention before trusting this bag.`;
  const counts = countFindingCategories(findings, "error");
  const breakdown = formatCategoryBreakdown(counts);

  if (!breakdown) {
    return base;
  }

  if (counts.diagnostics > 0 && counts.stream === 0 && counts.other === 0) {
    return `${base} ${breakdown} Topic CDR decode can still be ok.`;
  }

  if (counts.stream > 0 && counts.diagnostics === 0 && counts.other === 0 && errorCount === 1) {
    return base;
  }

  return `${base} ${breakdown}`;
}

function formatWarningDetail(warningCount: number, findings: readonly Finding[]): string {
  const base = `${warningCount} warning${warningCount === 1 ? "" : "s"} detected during scan.`;
  const counts = countFindingCategories(findings, "warning");
  const breakdown = formatCategoryBreakdown(counts);

  if (!breakdown) {
    return base;
  }

  if (counts.diagnostics > 0 && counts.stream === 0 && counts.other === 0) {
    return `${base} ${breakdown}`;
  }

  if (counts.stream > 0 && counts.diagnostics === 0 && counts.other === 0 && warningCount === 1) {
    return `${warningCount} warning detected during scan.`;
  }

  return `${base} ${breakdown}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
