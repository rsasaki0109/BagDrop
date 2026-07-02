import type { Finding, ResultBundle, Severity } from "../model/result";
import { formatNumber } from "../ui/format";

const SEVERITY_ORDER: Record<Severity, number> = {
  error: 0,
  warning: 1,
  info: 2
};

export interface FindingSummary {
  total: number;
  errors: number;
  warnings: number;
  info: number;
}

export function summarizeFindings(findings: readonly Finding[]): FindingSummary {
  let errors = 0;
  let warnings = 0;
  let info = 0;

  for (const finding of findings) {
    if (finding.severity === "error") {
      errors += 1;
    } else if (finding.severity === "warning") {
      warnings += 1;
    } else {
      info += 1;
    }
  }

  return {
    total: findings.length,
    errors,
    warnings,
    info
  };
}

export function sortFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((left, right) => {
    const severityDelta = SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity];
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const categoryDelta = findingCategory(left).localeCompare(findingCategory(right));
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function findingCategory(finding: Finding): string {
  if (finding.id.startsWith("inventory-")) {
    return "Inventory";
  }

  if (finding.id.startsWith("direct-file-vfs-")) {
    return "Storage";
  }

  if (
    finding.id.startsWith("sqlite-") ||
    finding.id.startsWith("missing-") ||
    finding.id.startsWith("opfs-")
  ) {
    return "Catalog";
  }

  if (
    finding.id.startsWith("stream-") ||
    finding.id.startsWith("cdr-decode-")
  ) {
    return "Stream";
  }

  if (finding.id.startsWith("diagnostic-")) {
    return "Diagnostics";
  }

  return "Other";
}

export function renderFindingsSummary(summary: FindingSummary): string {
  if (summary.total === 0) {
    return "0";
  }

  const parts: string[] = [];
  if (summary.errors > 0) {
    parts.push(`${formatNumber(summary.errors)} error${summary.errors === 1 ? "" : "s"}`);
  }
  if (summary.warnings > 0) {
    parts.push(`${formatNumber(summary.warnings)} warning${summary.warnings === 1 ? "" : "s"}`);
  }
  if (summary.info > 0) {
    parts.push(`${formatNumber(summary.info)} info`);
  }

  return parts.join(", ");
}

export function renderFindingsPanel(bundle: ResultBundle): string {
  const summary = summarizeFindings(bundle.findings);

  if (bundle.findings.length === 0) {
    return `<div class="quiet-message">No findings from inventory, catalog, or stream analysis.</div>`;
  }

  const sorted = sortFindings(bundle.findings);

  return `
    <div class="finding-summary-row">
      ${summary.errors > 0 ? `<span class="finding-summary-pill severity-error">${formatNumber(summary.errors)} error${summary.errors === 1 ? "" : "s"}</span>` : ""}
      ${summary.warnings > 0 ? `<span class="finding-summary-pill severity-warning">${formatNumber(summary.warnings)} warning${summary.warnings === 1 ? "" : "s"}</span>` : ""}
      ${summary.info > 0 ? `<span class="finding-summary-pill severity-info">${formatNumber(summary.info)} info</span>` : ""}
    </div>
    <ul class="finding-list">
      ${sorted.map((finding) => renderFindingItem(finding)).join("")}
    </ul>
  `;
}

function renderFindingItem(finding: Finding): string {
  const category = findingCategory(finding);

  return `
    <li class="finding ${severityClass(finding.severity)}">
      <div class="finding-meta">
        <span class="finding-severity">${escapeHtml(finding.severity)}</span>
        <span class="finding-category">${escapeHtml(category)}</span>
      </div>
      <div class="finding-body">
        <strong>${escapeHtml(finding.title)}</strong>
        <p>${escapeHtml(finding.detail)}</p>
        ${finding.topic ? `<button type="button" class="finding-topic-link" data-topic-name="${escapeHtml(finding.topic)}">${escapeHtml(finding.topic)}</button>` : ""}
        ${renderEvidence(finding)}
      </div>
    </li>
  `;
}

function renderEvidence(finding: Finding): string {
  if (!finding.evidence || Object.keys(finding.evidence).length === 0) {
    return "";
  }

  const rows = Object.entries(finding.evidence)
    .map(
      ([key, value]) => `
        <div class="finding-evidence-row">
          <dt>${escapeHtml(formatEvidenceKey(key))}</dt>
          <dd>${escapeHtml(formatEvidenceValue(value))}</dd>
        </div>
      `
    )
    .join("");

  return `<dl class="finding-evidence">${rows}</dl>`;
}

function formatEvidenceKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function severityClass(severity: Severity): string {
  return `severity-${severity}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
