/**
 * Phrase collection data model: pure types + pure functions.
 *
 * Saved phrases — multi-word selections the user kept with the popup Save
 * bookmark. In a later phase these entries become SRS flashcards, so ids
 * and keys are designed to be stable. No chrome.*, no DOM, no network —
 * storage lives in storage.ts.
 */

export const PHRASES_SCHEMA_VERSION = 1;

export interface PhraseEntry {
  id: string; // stable hash of the normalized text (see makePhraseId)
  text: string; // normalized phrase text — also the collection key
  context: string; // sentence context around the selection at save time
  definition: string; // first rendered AI item text
  firstSeen: number; // epoch ms
  lastSeen: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface PhraseCollectionData {
  schemaVersion: number;
  phrases: Record<string, PhraseEntry>; // key = normalizePhrase(raw text)
}

/**
 * Trim and collapse every whitespace run (spaces/tabs/newlines) to a
 * single space, then lowercase — the collection key.
 */
export function normalizePhrase(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * FNV-1a 32-bit hash over the UTF-16 code units of the text — the same
 * algorithm as makeWordId in the tracker model. Deterministic, synchronous,
 * no crypto APIs.
 */
export function makePhraseId(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function emptyPhraseCollection(): PhraseCollectionData {
  return { schemaVersion: PHRASES_SCHEMA_VERSION, phrases: {} };
}
