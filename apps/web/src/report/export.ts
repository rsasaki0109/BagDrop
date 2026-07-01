import type { ResultBundle } from "../model/result";

export function downloadResultBundle(bundle: ResultBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `bagdrop-report-${safeTimestamp(bundle.createdAt)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function safeTimestamp(value: string): string {
  return value.replaceAll(":", "").replaceAll(".", "");
}
