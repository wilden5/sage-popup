/**
 * Word tracker data model: pure types + pure functions.
 *
 * No chrome.*, no DOM, no network — storage lives in storage.ts and the
 * composition with normalization lives in counter.ts.
 */

export const WORD_TRACKER_SCHEMA_VERSION = 1;
export const DEFAULT_THRESHOLD = 3;

export type WordStatus = "active" | "ready" | "archived";

export interface WordEntry {
  id: string; // stable hash of the lemma (see makeWordId)
  lemma: string; // canonical form (tracker-normalized)
  forms: string[]; // distinct raw forms seen, first-seen order
  count: number; // meetings
  firstSeen: number; // epoch ms
  lastSeen: number; // epoch ms
  updatedAt: number; // epoch ms
  status: WordStatus;
  definition?: string; // first Oxford sense definition, if known
}

export interface WordTrackerData {
  schemaVersion: number;
  words: Record<string, WordEntry>; // key = lemma
}

/**
 * FNV-1a 32-bit hash over the UTF-16 code units of the lemma.
 * Deterministic, synchronous, no crypto APIs.
 */
export function makeWordId(lemma: string): string {
  let hash = 2166136261;
  for (let i = 0; i < lemma.length; i++) {
    hash ^= lemma.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function emptyTracker(): WordTrackerData {
  return { schemaVersion: WORD_TRACKER_SCHEMA_VERSION, words: {} };
}

/**
 * Record one meeting for `lemma` (raw form `rawWord`) and return the entry.
 * Mutates `data` in place.
 *
 * - New lemma: count 1, status "active", all timestamps = now.
 * - Existing lemma: count += 1, lastSeen/updatedAt = now, rawWord appended
 *   to forms only if not already present.
 * - definition is stored only when non-empty and the entry has none yet —
 *   never overwritten.
 * - status flips "active" -> "ready" once count reaches threshold; "ready"
 *   is never downgraded, "archived" is sticky.
 */
export function applyMeeting(
  data: WordTrackerData,
  lemma: string,
  rawWord: string,
  definition?: string,
  threshold?: number,
  now?: number
): WordEntry {
  const at = now ?? Date.now();
  const limit = threshold ?? DEFAULT_THRESHOLD;

  let entry = data.words[lemma];
  if (!entry) {
    entry = {
      id: makeWordId(lemma),
      lemma,
      forms: [rawWord],
      count: 1,
      firstSeen: at,
      lastSeen: at,
      updatedAt: at,
      status: "active",
    };
    if (typeof definition === "string" && definition !== "") {
      entry.definition = definition;
    }
    data.words[lemma] = entry;
    return entry;
  }

  entry.count += 1;
  entry.lastSeen = at;
  entry.updatedAt = at;
  if (!entry.forms.includes(rawWord)) {
    entry.forms.push(rawWord);
  }
  if (typeof definition === "string" && definition !== "" && entry.definition === undefined) {
    entry.definition = definition;
  }
  if (entry.status === "active" && entry.count >= limit) {
    entry.status = "ready";
  }
  return entry;
}
