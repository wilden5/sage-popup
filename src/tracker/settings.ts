/**
 * Word tracker settings: pure types + pure functions.
 *
 * Stored separately from the word list under the `wordTrackerSettings`
 * storage key (see storage.ts) so the wordTracker schema never has to
 * bump for a settings change. No chrome.*, no DOM.
 */

import { DEFAULT_THRESHOLD } from "./model";
import type { WordTrackerData } from "./model";

export const TRACKER_SETTINGS_SCHEMA_VERSION = 1;

export const MIN_THRESHOLD = 1;
export const MAX_THRESHOLD = 10;

export interface WordTrackerSettings {
  schemaVersion: number;
  threshold: number; // meetings after which a word is "ready to learn"
}

export function defaultTrackerSettings(): WordTrackerSettings {
  return { schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION, threshold: DEFAULT_THRESHOLD };
}

/**
 * Clamp any input to a valid threshold: an integer in [1, 10].
 * Non-finite input (NaN, ±Infinity) falls back to the default.
 */
export function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_THRESHOLD;
  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value)));
}

/**
 * Recompute the status of every non-archived entry against `threshold`.
 * Mutates `data` in place. Unlike meetings, a threshold change may
 * downgrade "ready" back to "active"; "archived" entries are untouched
 * and `updatedAt` is not modified by the recompute.
 */
export function applyThreshold(data: WordTrackerData, threshold: number): void {
  const limit = clampThreshold(threshold);
  for (const key of Object.keys(data.words)) {
    const entry = data.words[key];
    if (!entry || entry.status === "archived") continue;
    entry.status = entry.count >= limit ? "ready" : "active";
  }
}
