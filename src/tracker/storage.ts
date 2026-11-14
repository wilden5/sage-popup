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
