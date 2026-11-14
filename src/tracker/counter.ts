/**
 * Meeting counter: composes normalize + model + storage.
 *
 * One successful popup lookup of a single word = one meeting for its
 * normalized lemma. Multi-word phrases are not counted in this phase.
 */

import { normalize } from "./normalize";
import { applyMeeting } from "./model";
import type { WordEntry } from "./model";
import { readTracker, writeTracker } from "./storage";

export async function recordMeeting(rawWord: string, definition?: string): Promise<WordEntry | null> {
  const lemma = normalize(rawWord);
  if (!lemma || lemma.includes(" ")) return null;
  try {
    const data = await readTracker();
    const entry = applyMeeting(data, lemma, rawWord.trim().toLowerCase(), definition);
    await writeTracker(data);
    return entry;
  } catch (err) {
    // Storage unavailable or quota exceeded — the popup must never break, so swallow and report "not counted".
    return null;
  }
}
