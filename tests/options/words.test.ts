import { describe, it, expect } from "vitest";
import {
  WORDS_PAGE_SIZE,
  compareByMostMet,
  compareByRecentlySeen,
  countByStatus,
  filterByQuery,
  listWords,
  selectEntries,
} from "../../src/options/words";
import { makeWordId } from "../../src/tracker/model";
import type { WordEntry, WordStatus } from "../../src/tracker/model";

let seq = 0;

function makeEntry(lemma: string, overrides: Partial<WordEntry> = {}): WordEntry {
  seq += 1;
  return {
    id: makeWordId(lemma),
    lemma,
    forms: [lemma],
    count: 1,
    firstSeen: 1000,
    lastSeen: 1000,
    updatedAt: 1000,
    status: "active" as WordStatus,
    ...overrides,
  };
}

function sample(): WordEntry[] {
  return [
    makeEntry("go", { count: 5, lastSeen: 5000, status: "ready", definition: "to move" }),
    makeEntry("walk", { count: 5, lastSeen: 9000, status: "active" }),
    makeEntry("apple", { count: 2, lastSeen: 7000, status: "active" }),
    makeEntry("zebra", { count: 9, lastSeen: 1000, status: "ready" }),
    makeEntry("old", { count: 4, lastSeen: 3000, status: "archived" }),
  ];
}

describe("compareByMostMet", () => {
  it("sorts by count descending, ties by lemma ascending", () => {
    const rows = [makeEntry("b", { count: 5 }), makeEntry("a", { count: 5 }), makeEntry("c", { count: 9 })];
    rows.sort(compareByMostMet);
    expect(rows.map((r) => r.lemma)).toEqual(["c", "a", "b"]);
  });
});

describe("compareByRecentlySeen", () => {
  it("sorts by lastSeen descending, ties by count descending", () => {
    const rows = [
      makeEntry("old", { lastSeen: 100, count: 9 }),
      makeEntry("new-low", { lastSeen: 200, count: 1 }),
      makeEntry("new-high", { lastSeen: 200, count: 7 }),
    ];
    rows.sort(compareByRecentlySeen);
    expect(rows.map((r) => r.lemma)).toEqual(["new-high", "new-low", "old"]);
  });
});

describe("countByStatus", () => {
  it("counts all four buckets", () => {
    expect(countByStatus(sample())).toEqual({ all: 5, active: 2, ready: 2, archived: 1 });
  });

  it("handles an empty list", () => {
    expect(countByStatus([])).toEqual({ all: 0, active: 0, ready: 0, archived: 0 });
  });
});

describe("filterByQuery", () => {
  it("returns a copy of all entries for an empty or blank query", () => {
    const entries = sample();
    const rows = filterByQuery(entries, "   ");
    expect(rows).toHaveLength(5);
    expect(rows).not.toBe(entries); // a copy, not the live array
  });

  it("matches case-insensitively on the lemma only", () => {
    expect(filterByQuery(sample(), "GO").map((r) => r.lemma)).toEqual(["go"]);
    expect(filterByQuery(sample(), "zzz")).toEqual([]);
  });

  it("drives the live chip counts over the search result set", () => {
    // Spec example: searching "debris" -> "All (1)", "Ready (1)", empty buckets 0.
    const entries = sample();
    entries.push(makeEntry("debris", { status: "ready", count: 3 }));
    expect(countByStatus(filterByQuery(entries, "debris"))).toEqual({ all: 1, active: 0, ready: 1, archived: 0 });
    // No query -> the whole collection.
    expect(countByStatus(filterByQuery(entries, ""))).toEqual({ all: 6, active: 2, ready: 3, archived: 1 });
  });
});

describe("selectEntries", () => {
  it("filters by status", () => {
    const rows = selectEntries(sample(), "ready", "", "count");
    expect(rows.map((r) => r.lemma).sort()).toEqual(["go", "zebra"]);
  });

  it("maps the learning filter to active entries", () => {
    const rows = selectEntries(sample(), "active", "", "count");
    expect(rows.map((r) => r.lemma).sort()).toEqual(["apple", "walk"]);
  });

  it("matches the query case-insensitively as a substring of the lemma", () => {
    expect(selectEntries(sample(), "all", "GO", "count").map((r) => r.lemma)).toEqual(["go"]);
    expect(selectEntries(sample(), "all", "a", "count").map((r) => r.lemma).sort()).toEqual([
      "apple",
      "walk",
      "zebra",
    ]);
    expect(selectEntries(sample(), "all", "  WALK ", "count").map((r) => r.lemma)).toEqual(["walk"]);
    expect(selectEntries(sample(), "all", "qqq", "count")).toEqual([]);
  });

  it("does not match the query against forms or definitions", () => {
    const entries = [makeEntry("go", { forms: ["went"], definition: "to move from place to place" })];
    expect(selectEntries(entries, "all", "went", "count")).toEqual([]);
    expect(selectEntries(entries, "all", "move from", "count")).toEqual([]);
  });

  it("combines filter and query", () => {
    const rows = selectEntries(sample(), "active", "a", "count");
    expect(rows.map((r) => r.lemma).sort()).toEqual(["apple", "walk"]);
  });
});

describe("listWords", () => {
  it("returns everything on one page when under the page size", () => {
    const result = listWords(sample(), { statusFilter: "all", query: "", sort: "count", page: 1 });
    expect(result.total).toBe(5);
    expect(result.pageCount).toBe(1);
    expect(result.page).toBe(1);
    expect(result.rows.map((r) => r.lemma)).toEqual(["zebra", "go", "walk", "old", "apple"]);
  });

  it("sorts by most met: count desc, tie lemma asc", () => {
    const result = listWords(sample(), { statusFilter: "all", query: "", sort: "count", page: 1 });
    expect(result.rows.map((r) => r.lemma)).toEqual(["zebra", "go", "walk", "old", "apple"]);
  });

  it("sorts by recently seen: lastSeen desc, tie count desc", () => {
    const result = listWords(sample(), { statusFilter: "all", query: "", sort: "lastSeen", page: 1 });
    expect(result.rows.map((r) => r.lemma)).toEqual(["walk", "apple", "go", "old", "zebra"]);
  });

  it("paginates 20 per page", () => {
    const entries: WordEntry[] = [];
    for (let i = 0; i < 45; i++) {
      entries.push(makeEntry("w" + String(i).padStart(3, "0"), { count: i }));
    }
    const page1 = listWords(entries, { statusFilter: "all", query: "", sort: "count", page: 1 });
    expect(page1.rows).toHaveLength(WORDS_PAGE_SIZE);
    expect(page1.total).toBe(45);
    expect(page1.pageCount).toBe(3);
    expect(page1.rows[0]!.lemma).toBe("w044"); // highest count first
    const page2 = listWords(entries, { statusFilter: "all", query: "", sort: "count", page: 2 });
    expect(page2.rows).toHaveLength(20);
    expect(page2.rows[0]!.lemma).toBe("w024");
    const page3 = listWords(entries, { statusFilter: "all", query: "", sort: "count", page: 3 });
    expect(page3.rows).toHaveLength(5);
    expect(page3.page).toBe(3);
    // no overlap between pages
    const all = [...page1.rows, ...page2.rows, ...page3.rows].map((r) => r.lemma);
    expect(new Set(all).size).toBe(45);
  });

  it("clamps an overflowing page to the last page", () => {
    const entries = [makeEntry("a"), makeEntry("b")];
    const result = listWords(entries, { statusFilter: "all", query: "", sort: "count", page: 9 });
    expect(result.page).toBe(1);
    expect(result.rows).toHaveLength(2);
  });

  it("clamps page 0 / negative / NaN to page 1", () => {
    const entries = [makeEntry("a")];
    for (const p of [0, -3, NaN]) {
      const result = listWords(entries, { statusFilter: "all", query: "", sort: "count", page: p });
      expect(result.page).toBe(1);
    }
  });

  it("reports pageCount 1 and zero rows for an empty result", () => {
    const result = listWords(sample(), { statusFilter: "all", query: "qqq", sort: "count", page: 1 });
    expect(result).toEqual({ rows: [], total: 0, pageCount: 1, page: 1 });
  });

  it("applies the filter before paginating", () => {
    const entries: WordEntry[] = [];
    for (let i = 0; i < 25; i++) {
      entries.push(makeEntry("r" + i, { status: "ready", count: i }));
    }
    entries.push(makeEntry("a1", { status: "active", count: 100 }));
    const result = listWords(entries, { statusFilter: "ready", query: "", sort: "count", page: 2 });
    expect(result.total).toBe(25);
    expect(result.pageCount).toBe(2);
    expect(result.rows).toHaveLength(5);
    expect(result.rows.every((r) => r.status === "ready")).toBe(true);
  });
});
