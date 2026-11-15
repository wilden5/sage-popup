/**
 * chrome.storage.local persistence for the word tracker.
 *
 * This is the only tracker file allowed to touch chrome.* — everything
 * else stays pure or composes through counter.ts.
 */

import { WORD_TRACKER_SCHEMA_VERSION, emptyTracker } from "./model";
import type { WordTrackerData } from "./model";
import { TRACKER_SETTINGS_SCHEMA_VERSION, clampThreshold, defaultTrackerSettings } from "./settings";
import type { WordTrackerSettings } from "./settings";

export const WORD_TRACKER_KEY = "wordTracker";
export const WORD_TRACKER_SETTINGS_KEY = "wordTrackerSettings";

/**
 * Read the tracker data. Missing key, non-object value, or a schema
 * version mismatch all yield a fresh empty tracker — corrupt data must
 * never throw here.
 */
export async function readTracker(): Promise<WordTrackerData> {
  const result = await chrome.storage.local.get(WORD_TRACKER_KEY);
  const value = result[WORD_TRACKER_KEY];
  if (
    !value ||
    typeof value !== "object" ||
    (value as WordTrackerData).schemaVersion !== WORD_TRACKER_SCHEMA_VERSION
  ) {
    return emptyTracker();
  }
  return value as WordTrackerData;
}

export async function writeTracker(data: WordTrackerData): Promise<void> {
  await chrome.storage.local.set({ [WORD_TRACKER_KEY]: data });
}

/**
 * Global reset: write an empty collection (current schema version) to the
 * wordTracker key. The wordTrackerSettings key is data-independent and is
 * never touched here.
 */
export async function clearTracker(): Promise<void> {
  await chrome.storage.local.set({
    [WORD_TRACKER_KEY]: { schemaVersion: WORD_TRACKER_SCHEMA_VERSION, words: {} },
  });
}

/**
 * Remove every entry with status "archived" and write the rest back
 * unchanged (same persistence path as writeTracker). Non-archived entries
 * and their fields are kept intact.
 */
export async function clearArchived(): Promise<void> {
  const data = await readTracker();
  for (const lemma of Object.keys(data.words)) {
    const entry = data.words[lemma];
    if (entry && entry.status === "archived") delete data.words[lemma];
  }
  await writeTracker(data);
}

/**
 * Read the tracker settings. Missing key, non-object value, a schema
 * version mismatch, or a non-numeric threshold all yield the defaults —
 * corrupt data must never throw here. A numeric threshold is clamped
 * into the valid range.
 */
export async function readTrackerSettings(): Promise<WordTrackerSettings> {
  const result = await chrome.storage.local.get(WORD_TRACKER_SETTINGS_KEY);
  const value = result[WORD_TRACKER_SETTINGS_KEY];
  if (!value || typeof value !== "object") {
    return defaultTrackerSettings();
  }
  const stored = value as Partial<WordTrackerSettings>;
  if (
    stored.schemaVersion !== TRACKER_SETTINGS_SCHEMA_VERSION ||
    typeof stored.threshold !== "number" ||
    !Number.isFinite(stored.threshold)
  ) {
    return defaultTrackerSettings();
  }
  return {
    schemaVersion: TRACKER_SETTINGS_SCHEMA_VERSION,
    threshold: clampThreshold(stored.threshold),
  };
}

export async function writeTrackerSettings(settings: WordTrackerSettings): Promise<void> {
  await chrome.storage.local.set({ [WORD_TRACKER_SETTINGS_KEY]: settings });
}
