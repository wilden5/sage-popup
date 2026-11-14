/**
 * Word list view-model for the options page: pure filtering, sorting and
 * pagination over the tracker entries. No chrome.*, no DOM — the options
 * script (main.ts) renders what this module returns.
 */

import type { WordEntry } from "../tracker/model";

export const WORDS_PAGE_SIZE = 20;

/** Chip filter; "active" is labelled "Learning" in the UI. */
export type StatusFilter = "all" | "active" | "ready" | "archived";

/** Sort order: "count" = Most met, "lastSeen" = Recently seen. */
export type SortKey = "count" | "lastSeen";

export interface WordListQuery {
  statusFilter: StatusFilter;
  query: string; // case-insensitive substring on the lemma
  sort: SortKey;
  page: number; // 1-based
}

export interface WordListResult {
  rows: WordEntry[]; // the current page, in display order
  total: number; // entries matching filter + query (all pages)
  pageCount: number; // at least 1
  page: number; // the effective (clamped) page that was returned
}

export interface StatusCounts {
  all: number;
  active: number;
  ready: number;
  archived: number;
}

/** "Most met": count descending, ties by lemma ascending. */
export function compareByMostMet(a: WordEntry, b: WordEntry): number {
  if (b.count !== a.count) return b.count - a.count;
  return a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0;
}

/** "Recently seen": lastSeen descending, ties by count descending. */
export function compareByRecentlySeen(a: WordEntry, b: WordEntry): number {
  if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen;
  return b.count - a.count;
}

/** Per-status entry counts for the filter chips (ignores the query). */
export function countByStatus(entries: WordEntry[]): StatusCounts {
  const counts: StatusCounts = { all: entries.length, active: 0, ready: 0, archived: 0 };
  for (const entry of entries) {
    if (entry.status === "active") counts.active += 1;
    else if (entry.status === "ready") counts.ready += 1;
    else if (entry.status === "archived") counts.archived += 1;
  }
  return counts;
}

/**
 * Case-insensitive substring match of `query` against the lemma only
 * (never forms or definitions). Used both for the word list and for the
 * live chip counts, which describe the current search result set.
 */
export function filterByQuery(entries: WordEntry[], query: string): WordEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return entries.slice();
  return entries.filter((entry) => entry.lemma.toLowerCase().includes(q));
}

/** Filter by status chip + case-insensitive lemma substring, then sort. */
export function selectEntries(entries: WordEntry[], statusFilter: StatusFilter, query: string, sort: SortKey): WordEntry[] {
  const rows = filterByQuery(entries, query).filter(
    (entry) => statusFilter === "all" || entry.status === statusFilter
  );
  rows.sort(sort === "count" ? compareByMostMet : compareByRecentlySeen);
  return rows;
}

/**
 * Apply the full query: filter, sort, clamp the page into range and cut
 * the page (20 per page) out of the sorted list.
 */
export function listWords(entries: WordEntry[], query: WordListQuery): WordListResult {
  const sorted = selectEntries(entries, query.statusFilter, query.query, query.sort);
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / WORDS_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(query.page) || 1), pageCount);
  const start = (page - 1) * WORDS_PAGE_SIZE;
  return {
    rows: sorted.slice(start, start + WORDS_PAGE_SIZE),
    total,
    pageCount,
    page,
  };
}
