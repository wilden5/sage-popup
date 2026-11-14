/**
 * Meeting indicator policy: pure mapping from a WordEntry to what the
 * popup head row should show.
 *
 * No chrome.*, no DOM, no network — the popup wiring lives in
 * src/content/popup.ts.
 */

import type { WordEntry } from "./model";
import { DEFAULT_THRESHOLD } from "./model";

export interface MeetingIndicatorInfo {
  kind: "counter" | "ready" | "hidden";
  text: string;
  title: string;
}

/**
 * Status wins over count: a "ready" entry shows the ready badge even when
 * the passed threshold is higher than its count; an "archived" entry
 * shows nothing at all.
 */
export function meetingIndicator(entry: WordEntry, threshold?: number): MeetingIndicatorInfo {
  const limit = threshold ?? DEFAULT_THRESHOLD;
  if (entry.status === "archived") {
    return { kind: "hidden", text: "", title: "" };
  }
  if (entry.status === "ready") {
    return {
      kind: "ready",
      text: "ready to learn",
      title: "Met " + entry.count + " times — ready to learn.",
    };
  }
  return {
    kind: "counter",
    text: "seen " + entry.count + "/" + limit,
    title:
      "Met " +
      entry.count +
      " of " +
      limit +
      " times. When a word is met " +
      limit +
      " times, it is marked ready to learn.",
  };
}
