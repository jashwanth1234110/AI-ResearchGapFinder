import type { Gap } from "@/lib/api";

/** Backend gaps have no id — the topic-label pair is a stable enough key within one analysis. */
export function gapKey(gap: Gap): string {
  return `${gap.topic_a}__${gap.topic_b}`;
}

export function truncate(label: string, max = 24): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
