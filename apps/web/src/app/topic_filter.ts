import type { TopicCatalogEntry } from "../model/result";

export function filterTopics(
  topics: readonly TopicCatalogEntry[],
  query: string
): TopicCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return [...topics];
  }

  return topics.filter(
    (topic) =>
      topic.name.toLowerCase().includes(normalized) || topic.type.toLowerCase().includes(normalized)
  );
}
