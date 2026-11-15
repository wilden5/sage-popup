/**
 * chrome.storage.local persistence for the phrase collection.
 *
 * This is the only collection file allowed to touch chrome.* — everything
 * else stays pure in model.ts.
 */

import { PHRASES_SCHEMA_VERSION, emptyPhraseCollection, makePhraseId, normalizePhrase } from "./model";
import type { PhraseCollectionData, PhraseEntry } from "./model";

export const PHRASE_COLLECTION_KEY = "phraseCollection";

/**
 * Read the phrase collection. Missing key, non-object value, or a schema
 * version mismatch all yield a fresh empty collection — corrupt data must
 * never throw here.
 */
export async function readPhraseCollection(): Promise<PhraseCollectionData> {
  const result = await chrome.storage.local.get(PHRASE_COLLECTION_KEY);
  const value = result[PHRASE_COLLECTION_KEY];
  if (
    !value ||
    typeof value !== "object" ||
    (value as PhraseCollectionData).schemaVersion !== PHRASES_SCHEMA_VERSION
  ) {
    return emptyPhraseCollection();
  }
  return value as PhraseCollectionData;
}

export async function writePhraseCollection(data: PhraseCollectionData): Promise<void> {
  await chrome.storage.local.set({ [PHRASE_COLLECTION_KEY]: data });
}

/**
 * Save a phrase together with its context and definition. The key is the
 * normalized text, so a re-save never creates a duplicate: an existing
 * entry keeps its definition and firstSeen, gets the fresh context, and
 * bumps lastSeen/updatedAt. A new entry gets all timestamps = now.
 */
export async function savePhrase(rawText: string, context: string, definition: string): Promise<PhraseEntry> {
  const key = normalizePhrase(rawText);
  const now = Date.now();
  const data = await readPhraseCollection();
  let entry = data.phrases[key];
  if (entry) {
    entry.context = context;
    entry.lastSeen = now;
    entry.updatedAt = now;
  } else {
    entry = {
      id: makePhraseId(key),
      text: key,
      context,
      definition,
      firstSeen: now,
      lastSeen: now,
      updatedAt: now,
    };
    data.phrases[key] = entry;
  }
  await writePhraseCollection(data);
  return entry;
}

/** Remove the entry for `key` if present; a no-op otherwise. */
export async function deletePhrase(key: string): Promise<void> {
  const data = await readPhraseCollection();
  const entry = data.phrases[key];
  if (!entry) return;
  delete data.phrases[key];
  await writePhraseCollection(data);
}
