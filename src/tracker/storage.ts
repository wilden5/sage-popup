/**
 * chrome.storage.local persistence for the word tracker.
 *
 * This is the only tracker file allowed to touch chrome.* — everything
 * else stays pure or composes through counter.ts.
 */

import { WORD_TRACKER_SCHEMA_VERSION, emptyTracker } from "./model";
import type { WordTrackerData } from "./model";

export const WORD_TRACKER_KEY = "wordTracker";

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
