import type { ResultBundle } from "../model/result";

export const RESULT_BUNDLE_EXPORT_SCHEMA_VERSION = 1;

export function toExportableResultBundle(bundle: ResultBundle): ResultBundle {
  return {
    ...bundle,
    exportSchemaVersion: RESULT_BUNDLE_EXPORT_SCHEMA_VERSION,
    catalog: {
      ...bundle.catalog,
      topics: bundle.catalog.topics.map(
        ({
          intervalSeries: _intervalSeries,
          trajectorySeries: _trajectorySeries,
          geopointSeries: _geopointSeries,
          valueSeries: _valueSeries,
          angularVelocitySeries: _angularVelocitySeries,
          scanProfileSeries: _scanProfileSeries,
          ...topic
        }) => topic
      )
    }
  };
}

export function downloadResultBundle(bundle: ResultBundle): void {
  const blob = new Blob([JSON.stringify(toExportableResultBundle(bundle), null, 2)], {
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
